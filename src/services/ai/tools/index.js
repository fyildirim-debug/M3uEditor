/**
 * Yapay zeka asistaninin arac (function calling) kayit defteri.
 *
 * Araclar konuya gore modullere ayrilmistir ve burada tek bir katalogda
 * birlestirilir. Her arac dogrudan mevcut servis katmanini cagirir; HTTP
 * uzerinden kendi API'sine geri donmez. Boylece yetkilendirme (kullanici
 * sahipligi), dogrulama ve is kurallari tek yerde kalir.
 *
 * YETKI SINIRI: Her arac yalnizca `ctx.userId` ile calisir ve bu deger
 * oturumdan gelir; modelin urettigi argumanlardan kullanici kimligi kabul
 * edilmez. Yonetici uclari kataloga hic alinmaz — asistanin yetkisi, hesap
 * yonetici olsa bile, kendi kullanicisinin veri erisimiyle sinirlidir.
 */

const logger = require('../../../config/logger');
const { createAppError } = require('../../../utils/AppError');

// Sira onemli: saglayici arac sayisini sinirlarsa bastakiler gonderilir.
const MODULES = [
  require('./playlists'),
  require('./categories'),
  require('./channels'),
  require('./epg'),
  require('./imports'),
  require('./exports'),
  require('./account'),
];

// Bircok saglayici tek istekte gonderilebilecek arac sayisini sinirlar
// (OpenAI'de 128). Katalog bunun uzerindeyse ust siniri asmayiz; kalan
// araclar meta araclarla (search_capabilities + invoke_capability) erisilebilir
// kalir, yani hicbir yetenek ulasilamaz duruma dusmez.
const DEFAULT_TOOL_LIMIT = 120;

const tools = {};
for (const module of MODULES) {
  for (const [name, tool] of Object.entries(module)) {
    if (tools[name]) throw new Error(`Yinelenen araç adı: ${name}`);
    tools[name] = tool;
  }
}

/** Modelin kimlik alanlarini kendi uydurmasini engeller. */
const FORBIDDEN_ARG_KEYS = new Set(['userId', 'user_id', 'ownerId', 'owner_id', 'isAdmin', 'is_admin']);

function sanitizeArgs(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return {};
  const clean = {};
  for (const [key, value] of Object.entries(args)) {
    if (FORBIDDEN_ARG_KEYS.has(key)) continue;
    clean[key] = value;
  }
  return clean;
}

function toDefinition(name, tool) {
  return {
    type: 'function',
    function: {
      name,
      description: tool.destructive ? `[YIKICI] ${tool.description}` : tool.description,
      // Sema kasitli olarak sade tutulur (yalnizca type/properties/required,
      // birlesik tip yok, additionalProperties yok): OpenAI semasini Anthropic
      // veya Gemini bicimine ceviren gecitler bu anahtarlari reddedip 400
      // donebiliyor. Bilinmeyen alanlar zaten sunucuda ayiklanir.
      parameters: tool.parameters,
    },
  };
}

/* ─────────────────── Meta araclar ─────────────────── */

const metaTools = {
  search_capabilities: {
    description: 'Asistanın tüm yetenek kataloğunda arama yapar. Aradığın işi yapan araç bu turda gönderilmemiş olabilir; adını buradan bulup invoke_capability ile çağırabilirsin.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Anahtar kelime, örn "logo", "yedek", "sırala"' },
        limit: { type: 'integer' },
      },
      required: ['query'],
    },
    async run(args) {
      const needle = String(args.query || '').trim().toLocaleLowerCase('tr-TR');
      if (!needle) throw createAppError('VALIDATION_ERROR', 'query gerekli');
      const limit = Math.min(Math.max(Number(args.limit) || 15, 1), 60);
      const matches = Object.entries(tools)
        .filter(([name, tool]) => `${name} ${tool.description}`.toLocaleLowerCase('tr-TR').includes(needle))
        .slice(0, limit)
        .map(([name, tool]) => ({
          name,
          description: tool.description,
          destructive: tool.destructive === true,
          parameters: Object.keys(tool.parameters?.properties || {}),
        }));
      return { total: matches.length, tools: matches };
    },
  },

  describe_capability: {
    description: 'Bir aracın tam parametre şemasını verir; invoke_capability ile çağırmadan önce kullanılır.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
    async run(args) {
      const tool = tools[args.name];
      if (!tool) throw createAppError('NOT_FOUND', `Bilinmeyen araç: ${args.name}`);
      return {
        name: args.name,
        description: tool.description,
        destructive: tool.destructive === true,
        parameters: tool.parameters,
      };
    },
  },

  invoke_capability: {
    description: 'Katalogdaki herhangi bir aracı adıyla çalıştırır. Bu turda doğrudan gönderilmemiş araçlara erişmenin yoludur.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'search_capabilities ile bulunan araç adı' },
        args: { type: 'object', description: 'Aracın parametreleri' },
      },
      required: ['name'],
    },
    async run(args, ctx) {
      const tool = tools[args.name];
      if (!tool) throw createAppError('NOT_FOUND', `Bilinmeyen araç: ${args.name}`);
      // Ayni yetki baglamiyla calisir; izinler atlanmaz.
      return tool.run(sanitizeArgs(args.args), ctx);
    },
  },
};

/**
 * OpenAI `tools` dizisi biciminde arac tanimlari.
 * @param {{ limit?: number }} [options] - Tek istekte gonderilecek azami arac sayisi.
 */
function definitions(options = {}) {
  const rawLimit = Number(options.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.trunc(rawLimit) : DEFAULT_TOOL_LIMIT;
  const meta = Object.entries(metaTools).map(([name, tool]) => toDefinition(name, tool));
  const entries = Object.entries(tools);
  const room = Math.max(limit - meta.length, 1);
  return [...entries.slice(0, room).map(([name, tool]) => toDefinition(name, tool)), ...meta];
}

/** Tum katalog (arayuzde gostermek ve dokumantasyon icin). */
function catalogue() {
  return [...Object.entries(tools), ...Object.entries(metaTools)].map(([name, tool]) => ({
    name,
    description: tool.description,
    destructive: tool.destructive === true,
  }));
}

function isDestructive(name) {
  return tools[name]?.destructive === true;
}

/**
 * Bir araci calistirir. Hatalar modele yapilandirilmis sekilde doner ki
 * asistan kendini duzeltebilsin; beklenmeyen hatalar loglanir.
 */
async function execute(name, args, ctx) {
  const tool = tools[name] || metaTools[name];
  if (!tool) return { ok: false, error: `Bilinmeyen araç: ${name}` };
  if (!ctx?.userId) return { ok: false, error: 'Oturum bulunamadı' };

  try {
    const result = await tool.run(sanitizeArgs(args), ctx);
    return { ok: true, result: result === undefined ? { success: true } : result };
  } catch (error) {
    if (!error?.code) logger.error({ err: error, tool: name, userId: ctx.userId }, 'AI tool failed');
    else logger.info({ tool: name, code: error.code, userId: ctx.userId }, 'AI tool rejected');
    return { ok: false, error: error?.message || 'Araç çalıştırılamadı', code: error?.code };
  }
}

module.exports = {
  definitions,
  catalogue,
  execute,
  isDestructive,
  names: [...Object.keys(tools), ...Object.keys(metaTools)],
  DEFAULT_TOOL_LIMIT,
};
