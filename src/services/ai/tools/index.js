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
  require('./logos'),
  require('./attachments'),
  require('./tasks'),
  require('./account'),
];

// Bircok saglayici tek istekte gonderilebilecek arac sayisini sinirlar
// (OpenAI'de 128). Katalog bunun uzerinde oldugu icin her turda bir alt kume
// gonderilir; hangi alt kume oldugu SABIT DEGIL, kullanicinin mesajina gore
// secilir (bkz. rankTools). Skor uretmeyen durumda modul sirasina dusulur ve
// kalan araclar meta araclarla (search_capabilities + invoke_capability)
// erisilebilir kalir, yani hicbir yetenek ulasilamaz duruma dusmez.
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

/* ─────────────────── Alaka siralamasi ─────────────────── */

// Skor uretmeyen, her metinde gecen kelimeler. Bunlar elenmezse her arac
// esit puan alir ve siralama anlamsizlasir.
const STOP_WORDS = new Set([
  'için', 'ile', 'bir', 'bu', 'şu', 'the', 'and', 'for', 'with', 'var', 'yok',
  'olan', 'gibi', 'daha', 'sonra', 'önce', 'tüm', 'hepsi', 'lütfen', 'bana',
  'yap', 'yapar', 'misin', 'mısın', 'ver', 'göster', 'istiyorum', 'lazım',
]);

// Turkce ekler govdeyi degistirmedigi icin (yedek/yedekle/yedegi) kelimenin
// bas kismi uzerinden eslesiyoruz; tam kelime karsilastirmasi "kategoriler"i
// "kategori" ile eslestiremezdi.
const STEM_LENGTH = 4;

function normalizeText(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[_\-/]+/g, ' ')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ');
}

function tokenize(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

/**
 * Bir aracin verilen ipucu kelimelerine gore alaka puani.
 * Ad eslesmesi aciklamadan agir basar: `create_backup`, "yedek al" isteginde
 * yedekten bahseden bir aciklamadan daha guclu bir sinyaldir.
 */
function scoreTool(name, tool, tokens) {
  if (!tokens.length) return 0;
  const nameWords = tokenize(name);
  const descWords = tokenize(tool.description);
  let score = 0;

  for (const token of tokens) {
    const stem = token.slice(0, STEM_LENGTH);
    if (nameWords.includes(token)) score += 8;
    else if (nameWords.some((word) => word.startsWith(stem))) score += 5;

    if (descWords.includes(token)) score += 3;
    else if (descWords.some((word) => word.startsWith(stem))) score += 2;
  }
  return score;
}

/**
 * Araclari alakaya gore siralar. Skor esitliginde modul sirasi korunur, yani
 * ipucu yoksa davranis eskisiyle birebir ayni kalir (deterministik).
 */
function rankTools(tokens) {
  const entries = Object.entries(tools);
  if (!tokens.length) return entries;
  return entries
    .map((entry, index) => ({ entry, index, score: scoreTool(entry[0], entry[1], tokens) }))
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
    .map((item) => item.entry);
}

/* ─────────────────── Sema dogrulamasi ─────────────────── */

const TYPE_CHECKS = {
  string: (value) => typeof value === 'string',
  number: (value) => typeof value === 'number' && Number.isFinite(value),
  integer: (value) => Number.isInteger(value),
  boolean: (value) => typeof value === 'boolean',
  array: (value) => Array.isArray(value),
  object: (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
};

/**
 * Arac calismadan once semaya karsi hafif dogrulama. Amac guvenlik degil geri
 * bildirim: model eksik ya da yanlis tipte arguman gonderdiginde araclarin
 * kendi ad hoc hatalarini beklemek yerine ne yapmasi gerektigini soyleriz,
 * boylece bir sonraki adimda kendini duzeltir.
 */
function validateArgs(tool, args) {
  const properties = tool.parameters?.properties || {};
  const required = Array.isArray(tool.parameters?.required) ? tool.parameters.required : [];
  const problems = [];

  for (const key of required) {
    const value = args[key];
    if (value === undefined || value === null || value === '') {
      problems.push(`"${key}" zorunlu ama gönderilmedi`);
    }
  }

  for (const [key, value] of Object.entries(args)) {
    const spec = properties[key];
    // Sema disi anahtarlar sessizce gecer: araclar zaten yalnizca bildikleri
    // alanlari okur ve saglayicilar bazen fazladan alan ekler.
    if (!spec || value === undefined || value === null) continue;
    const check = TYPE_CHECKS[spec.type];
    if (check && !check(value)) {
      problems.push(`"${key}" ${spec.type} olmalı, ${Array.isArray(value) ? 'array' : typeof value} gönderildi`);
    }
    if (Array.isArray(spec.enum) && spec.enum.length && !spec.enum.includes(value)) {
      problems.push(`"${key}" şunlardan biri olmalı: ${spec.enum.join(', ')}`);
    }
  }

  return problems;
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
      const tokens = tokenize(args.query);
      if (!tokens.length) throw createAppError('VALIDATION_ERROR', 'query gerekli');
      const limit = Math.min(Math.max(Number(args.limit) || 15, 1), 60);
      // Duz substring yerine skorlama: "logoları çek" sorgusu "logo" gecen her
      // araci degil, en alakalilari basta getirir ve ekli kelimeleri de yakalar.
      const matches = Object.entries(tools)
        .map(([name, tool]) => ({ name, tool, score: scoreTool(name, tool, tokens) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ name, tool }) => ({
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
 *
 * `hints` verildiginde (kullanicinin mesaji + son calistirilan araclar) katalog
 * alakaya gore siralanir. Onemi: katalog 159 arac, tek istekte gonderilebilen
 * ise ~117. Sabit sirada gonderildiginde son modullerin (imports/exports/
 * account) tamami hicbir zaman dogrudan gorunmuyordu ve model onlara ancak
 * search_capabilities uzerinden, fazladan bir tur harcayarak ulasabiliyordu.
 *
 * @param {{ limit?: number, hints?: string }} [options]
 */
function definitions(options = {}) {
  const rawLimit = Number(options.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.trunc(rawLimit) : DEFAULT_TOOL_LIMIT;
  const meta = Object.entries(metaTools).map(([name, tool]) => toDefinition(name, tool));
  const ranked = rankTools(tokenize(options.hints));
  const room = Math.max(limit - meta.length, 1);
  return [...ranked.slice(0, room).map(([name, tool]) => toDefinition(name, tool)), ...meta];
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

// Salt-okuma araclari birbirinden bagimsizdir, ayni turda paralel
// calistirilabilir. Yazan araclarda sira onemli oldugu icin liste bilincli
// olarak dar tutuldu: yalnizca evrensel okuma onekleri.
const READ_ONLY_PREFIXES = ['list_', 'get_', 'search_', 'find_', 'describe_', 'count_', 'preview_', 'read_'];

function isReadOnly(name) {
  if (!tools[name] && !metaTools[name]) return false;
  if (tools[name]?.destructive === true) return false;
  return READ_ONLY_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/**
 * Bir araci calistirir. Hatalar modele yapilandirilmis sekilde doner ki
 * asistan kendini duzeltebilsin; beklenmeyen hatalar loglanir.
 */
async function execute(name, args, ctx) {
  const tool = tools[name] || metaTools[name];
  if (!tool) return { ok: false, error: `Bilinmeyen araç: ${name}` };
  if (!ctx?.userId) return { ok: false, error: 'Oturum bulunamadı' };

  const clean = sanitizeArgs(args);

  // Yikici izin kapisi burada, tek yerde. Araclar ayrica assertDestructive
  // cagiriyor ama yeni bir arac bunu unutursa izin sessizce atlanmasin.
  if (tool.destructive === true && ctx.allowDestructive !== true) {
    return { ok: false, error: 'Silme ve üzerine yazma işlemleri bu oturumda kapalı. Kullanıcı yapay zeka ayarlarından açabilir.', code: 'FORBIDDEN' };
  }

  const problems = validateArgs(tool, clean);
  if (problems.length) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      error: `Geçersiz parametreler: ${problems.join('; ')}`,
      // Semayi geri veriyoruz ki model bir sonraki denemede dogru cagirsin.
      schema: tool.parameters,
    };
  }

  try {
    const result = await tool.run(clean, ctx);
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
  isReadOnly,
  scoreTool,
  tokenize,
  validateArgs,
  names: [...Object.keys(tools), ...Object.keys(metaTools)],
  DEFAULT_TOOL_LIMIT,
};
