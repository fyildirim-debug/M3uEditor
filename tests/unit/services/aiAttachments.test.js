const os = require('os');
const path = require('path');
const fs = require('fs/promises');

// jest.mock fabrikasi yalnizca `mock` onekli degiskene erisebilir.
const mockTestDir = path.join(os.tmpdir(), `ai-attachments-test-${process.pid}`);

const mockDb = jest.fn();
mockDb.fn = { now: jest.fn(() => 'NOW') };
jest.mock('../../../src/config/database', () => mockDb);

jest.mock('../../../src/config', () => ({
  aiAttachmentDir: mockTestDir,
  ai: {
    maxMessageChars: 1_000_000,
    inlineMessageChars: 100,
    attachmentBytes: 1024,
    attachmentQuotaBytes: 4096,
    minTaskIntervalMinutes: 15,
  },
  limits: { m3uBytes: 20 * 1024 * 1024 },
}));

const attachments = require('../../../src/services/ai/attachments');

/**
 * Knex zincirini taklit eder. `save` once kotayi sorar (sum + first), sonra
 * insert + returning yapar; testler ikisini de bu kurucudan besler.
 */
function builder({ rows = [], first, returning = [], sum } = {}) {
  const query = {};
  for (const method of ['where', 'andWhere', 'orderBy', 'select', 'limit', 'insert', 'update', 'del', 'sum']) {
    query[method] = jest.fn(() => query);
  }
  if (sum !== undefined) query.first = jest.fn().mockResolvedValue({ total: sum });
  else query.first = jest.fn().mockResolvedValue(first);
  query.returning = jest.fn().mockResolvedValue(returning);
  query.then = (resolve, reject) => Promise.resolve(rows).then(resolve, reject);
  return query;
}

/** Insert edilen satiri, veritabanindan okunmus gibi geri veren kurulum. */
function expectStore({ used = 0 } = {}) {
  const inserted = {};
  mockDb.mockImplementation(() => {
    const query = builder({ sum: used });
    query.insert = jest.fn((row) => {
      Object.assign(inserted, row);
      return { returning: jest.fn().mockResolvedValue([{ ...row, created_at: new Date().toISOString() }]) };
    });
    return query;
  });
  return inserted;
}

afterAll(async () => {
  await fs.rm(mockTestDir, { recursive: true, force: true });
});

describe('AI attachment format detection', () => {
  test.each([
    ['#EXTM3U\n#EXTINF:-1,Kanal\nhttp://x/1.ts', 'liste.m3u', 'm3u'],
    ['<?xml version="1.0"?><tv><channel id="a"/></tv>', 'rehber.xml', 'xmltv'],
    ['[{"name":"a"}]', 'veri.json', 'json'],
    ['ad,url\nKanal,http://x\n', 'tablo.csv', 'csv'],
    ['sadece duz metin', 'not.txt', 'text'],
  ])('detects %# correctly', (content, filename, expected) => {
    expect(attachments.detectFormat(content, filename)).toBe(expected);
  });

  test('trusts content over extension', () => {
    // .txt uzantili ama gercekte M3U olan dosya yine M3U sayilir.
    expect(attachments.detectFormat('#EXTM3U\n#EXTINF:-1,A\nhttp://x', 'liste.txt')).toBe('m3u');
  });
});

describe('AI attachment store', () => {
  beforeEach(() => jest.clearAllMocks());

  test('writes the file to disk and records metadata', async () => {
    const inserted = expectStore();
    const content = '#EXTM3U\n#EXTINF:-1 group-title="Spor",Kanal 1\nhttp://x/1.ts\n';

    const file = await attachments.save('user-1', { conversationId: 'conv-1', filename: 'liste.m3u', content });

    expect(inserted.format).toBe('m3u');
    expect(inserted.user_id).toBe('user-1');
    expect(inserted.size_bytes).toBe(Buffer.byteLength(content));
    expect(JSON.parse(inserted.meta)).toMatchObject({ entryCount: 1, groupCount: 1 });
    expect(await fs.readFile(inserted.storage_path, 'utf8')).toBe(content);
    expect(file.downloadUrl).toBe(`/api/ai/attachments/${inserted.id}/download`);
  });

  test('rejects a file larger than the per-file limit', async () => {
    expectStore();
    await expect(attachments.save('user-1', { filename: 'buyuk.txt', content: 'x'.repeat(2000) }))
      .rejects.toThrow(/en fazla/i);
  });

  test('rejects an upload that would exceed the account quota', async () => {
    expectStore({ used: 4000 });
    await expect(attachments.save('user-1', { filename: 'a.txt', content: 'x'.repeat(200) }))
      .rejects.toThrow(/dosya alanı doldu/i);
  });

  test('rejects empty content', async () => {
    expectStore();
    await expect(attachments.save('user-1', { filename: 'bos.txt', content: '   \n' }))
      .rejects.toThrow(/boş/i);
  });

  test('stores the file under an id, never under the supplied name', async () => {
    const inserted = expectStore();
    await attachments.save('user-1', { filename: '../../../etc/passwd', content: 'merhaba' });

    // Ad yalnizca gosterim icin temizlenir; disk yolu her zaman kimliktir.
    expect(inserted.storage_path).toBe(path.join(mockTestDir, 'user-1', inserted.id));
    expect(inserted.filename).not.toContain('/');
    expect(path.dirname(inserted.storage_path)).toBe(path.join(mockTestDir, 'user-1'));
  });
});

describe('AI attachment reading', () => {
  beforeEach(() => jest.clearAllMocks());

  /** Diske gercek bir dosya yazar ve satirini dondurur. */
  async function seed(content, format = 'text') {
    const id = `seed-${Math.random().toString(36).slice(2)}`;
    const storagePath = path.join(mockTestDir, 'user-1', id);
    await fs.mkdir(path.dirname(storagePath), { recursive: true });
    await fs.writeFile(storagePath, content, 'utf8');
    return { id, user_id: 'user-1', filename: 'test.txt', format, storage_path: storagePath, size_bytes: Buffer.byteLength(content), line_count: content.split('\n').length, meta: '{}' };
  }

  test('reads a line window and reports where to continue', async () => {
    const row = await seed([...Array(500)].map((_, index) => `satir-${index + 1}`).join('\n'));
    mockDb.mockReturnValue(builder({ first: row }));

    const page = await attachments.readWindow('user-1', row.id, { startLine: 10, lineCount: 5 });

    expect(page.content.split('\n')).toEqual(['satir-10', 'satir-11', 'satir-12', 'satir-13', 'satir-14']);
    expect(page.totalLines).toBe(500);
    expect(page.nextStartLine).toBe(15);
  });

  test('returns null nextStartLine at the end of the file', async () => {
    const row = await seed('bir\niki\nuc');
    mockDb.mockReturnValue(builder({ first: row }));

    const page = await attachments.readWindow('user-1', row.id, { startLine: 1, lineCount: 100 });
    expect(page.nextStartLine).toBeNull();
    expect(page.returnedLines).toBe(3);
  });

  test('searches lines and reports their numbers', async () => {
    const row = await seed('Kanal A\nKanal B\nSpor HD\nkanal c');
    mockDb.mockReturnValue(builder({ first: row }));

    const result = await attachments.search('user-1', row.id, { query: 'kanal' });

    expect(result.matchCount).toBe(3);
    expect(result.matches.map((match) => match.line)).toEqual([1, 2, 4]);
  });

  test('honours case sensitivity when asked', async () => {
    const row = await seed('Kanal A\nkanal b');
    mockDb.mockReturnValue(builder({ first: row }));

    const result = await attachments.search('user-1', row.id, { query: 'Kanal', caseSensitive: true });
    expect(result.matchCount).toBe(1);
  });

  test('another user cannot reach the file', async () => {
    mockDb.mockReturnValue(builder({ first: undefined }));
    await expect(attachments.readWindow('user-2', 'someone-elses-id')).rejects.toThrow(/bulunamadı/i);
  });

  test('reports a missing file on disk as not found', async () => {
    mockDb.mockReturnValue(builder({ first: { id: 'ghost', user_id: 'user-1', storage_path: path.join(mockTestDir, 'user-1', 'yok') } }));
    await expect(attachments.readRaw('user-1', 'ghost')).rejects.toThrow(/bulunamadı/i);
  });
});
