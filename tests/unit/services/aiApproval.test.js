/**
 * Onay akisi ve uzun mesajin eke donusturulmesi.
 *
 * Bu testler saglayiciyi ve veritabanini taklit eder; amaclari asistanin
 * yikici bir cagriyi ONAY ALMADAN calistirmadigini ve 8.000 karakterlik eski
 * sinirin yerini otomatik ek mekanizmasinin aldigini kanitlamak.
 */

const mockDb = jest.fn();
mockDb.fn = { now: jest.fn(() => 'NOW') };
mockDb.raw = jest.fn(() => ({ rows: [], rowCount: 0 }));
jest.mock('../../../src/config/database', () => mockDb);

const mockSafeFetchText = jest.fn();
jest.mock('../../../src/utils/safeFetch', () => ({
  safeFetchText: (...args) => mockSafeFetchText(...args),
  parseRemoteUrl: (value) => new URL(value),
  requestStream: jest.fn(),
  safeFetchJson: jest.fn(),
  requestBuffer: jest.fn(),
}));

const mockExecute = jest.fn();
jest.mock('../../../src/services/ai/tools', () => ({
  definitions: jest.fn(() => [{ type: 'function', function: { name: 'delete_channels', description: 'x', parameters: { type: 'object', properties: { channelIds: { type: 'array' } } } } }]),
  execute: (...args) => mockExecute(...args),
  isDestructive: (name) => name === 'delete_channels',
  isReadOnly: (name) => name.startsWith('list_') || name.startsWith('get_'),
  names: ['list_playlists', 'delete_channels'],
}));

const mockAttachmentSave = jest.fn();
jest.mock('../../../src/services/ai/attachments', () => ({
  save: (...args) => mockAttachmentSave(...args),
  list: jest.fn().mockResolvedValue([]),
  require: jest.fn(),
  rowToPublic: (row) => row,
  removeByConversation: jest.fn().mockResolvedValue(0),
}));

const aiService = require('../../../src/services/AIService');
const { encrypt } = require('../../../src/utils/crypto');

const SETTINGS = {
  user_id: 'user-1',
  base_url: 'https://api.openai.com/v1',
  api_key_enc: encrypt('sk-test'),
  model: 'gpt-4o-mini',
  temperature: '0.2',
  max_steps: 5,
  allow_destructive: true,
  require_approval: true,
};

function builder({ rows = [], first, returning = [] } = {}) {
  const query = {};
  for (const method of ['where', 'andWhere', 'orWhere', 'orderBy', 'select', 'limit', 'insert', 'update', 'del', 'join', 'leftJoin', 'groupBy', 'count', 'sum', 'whereNull', 'whereRaw', 'andWhereRaw', 'orWhereRaw', 'whereNotNull']) {
    query[method] = jest.fn(() => query);
  }
  query.first = jest.fn().mockResolvedValue(first);
  query.returning = jest.fn().mockResolvedValue(returning);
  query.then = (resolve, reject) => Promise.resolve(rows).then(resolve, reject);
  return query;
}

/** Tabloya gore ayri zincir dondurur; boylece cagri sirasi degisse de test kirilmaz. */
function mockTables(overrides = {}) {
  const inserts = { ai_messages: [], ai_pending_actions: [], ai_conversations: [] };
  const tables = {
    ai_settings: () => builder({ first: SETTINGS }),
    ai_conversations: () => builder({ returning: [{ id: 'conv-1', user_id: 'user-1', playlist_id: null }] }),
    ai_messages: () => builder({ rows: [] }),
    ai_pending_actions: () => builder({ returning: [{ id: 'pending-1', tool_name: 'delete_channels', args: '{"channelIds":["c1","c2"]}', impact: 'Etkilenecek: 2 kanal.', created_at: 'now' }] }),
    playlists: () => builder({ rows: [], first: undefined }),
    ...overrides,
  };
  mockDb.mockImplementation((table) => {
    const query = (tables[table] || (() => builder()))();
    const originalInsert = query.insert;
    query.insert = jest.fn((row) => {
      if (inserts[table]) inserts[table].push(row);
      return originalInsert(row);
    });
    return query;
  });
  return inserts;
}

function providerReplies(...payloads) {
  for (const payload of payloads) mockSafeFetchText.mockResolvedValueOnce({ text: JSON.stringify(payload) });
}

const TOOL_CALL_TURN = {
  choices: [{
    message: {
      content: null,
      tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'delete_channels', arguments: '{"channelIds":["c1","c2"]}' } }],
    },
  }],
};

describe('AI destructive approval flow', () => {
  beforeEach(() => jest.clearAllMocks());

  test('pauses a destructive call instead of running it', async () => {
    const inserts = mockTables();
    providerReplies(TOOL_CALL_TURN);

    const result = await aiService.chat('user-1', { message: 'iki kanalı sil' });

    expect(mockExecute).not.toHaveBeenCalled();
    expect(result.pendingApproval).toMatchObject({ id: 'pending-1', tool: 'delete_channels' });
    expect(result.reply).toBe('');
    // Onay bekleyen cagri ve ayni turdaki kalanlar kuyrukta saklanir.
    const [pending] = inserts.ai_pending_actions;
    expect(JSON.parse(pending.queued_calls)).toHaveLength(1);
    expect(pending.tool_call_id).toBe('call-1');
  });

  test('runs the call normally when approval is not required', async () => {
    mockTables({ ai_settings: () => builder({ first: { ...SETTINGS, require_approval: false } }) });
    providerReplies(TOOL_CALL_TURN, { choices: [{ message: { content: '2 kanal silindi.' } }] });
    mockExecute.mockResolvedValue({ ok: true, result: { deleted: 2 } });

    const result = await aiService.chat('user-1', { message: 'iki kanalı sil' });

    expect(mockExecute).toHaveBeenCalledWith('delete_channels', { channelIds: ['c1', 'c2'] }, expect.objectContaining({ userId: 'user-1' }));
    expect(result.pendingApproval).toBeNull();
    expect(result.reply).toBe('2 kanal silindi.');
  });

  test('a scheduled task run never waits for approval', async () => {
    mockTables();
    providerReplies(TOOL_CALL_TURN, { choices: [{ message: { content: 'bitti' } }] });
    mockExecute.mockResolvedValue({ ok: true, result: { deleted: 2 } });

    // requireApproval acikca kapatildiginda (gorev calistirmasi) cagri yurutulur.
    const result = await aiService.chat('user-1', { message: 'temizle', requireApproval: false, isTaskRun: true });

    expect(mockExecute).toHaveBeenCalled();
    expect(result.pendingApproval).toBeNull();
  });

  test('rejecting an approval closes the queued calls and does not run them', async () => {
    mockTables({
      ai_pending_actions: () => builder({
        first: {
          id: 'pending-1',
          user_id: 'user-1',
          conversation_id: 'conv-1',
          status: 'pending',
          tool_name: 'delete_channels',
          args: '{"channelIds":["c1"]}',
          queued_calls: JSON.stringify([{ id: 'call-1', function: { name: 'delete_channels', arguments: '{"channelIds":["c1"]}' } }]),
        },
      }),
      ai_conversations: () => builder({ first: { id: 'conv-1', user_id: 'user-1', playlist_id: null } }),
    });
    providerReplies({ choices: [{ message: { content: 'Tamam, silmedim.' } }] });

    const result = await aiService.resolveApproval('user-1', 'pending-1', { approved: false });

    expect(mockExecute).not.toHaveBeenCalled();
    expect(result.steps[0]).toMatchObject({ tool: 'delete_channels', ok: false, error: 'Kullanıcı onaylamadı' });
    expect(result.reply).toBe('Tamam, silmedim.');
  });

  test('approving an approval runs exactly the stored call', async () => {
    mockTables({
      ai_pending_actions: () => builder({
        first: {
          id: 'pending-1',
          user_id: 'user-1',
          conversation_id: 'conv-1',
          status: 'pending',
          tool_name: 'delete_channels',
          args: '{"channelIds":["c1"]}',
          queued_calls: JSON.stringify([{ id: 'call-1', function: { name: 'delete_channels', arguments: '{"channelIds":["c1"]}' } }]),
        },
      }),
      ai_conversations: () => builder({ first: { id: 'conv-1', user_id: 'user-1', playlist_id: null } }),
    });
    providerReplies({ choices: [{ message: { content: '1 kanal silindi.' } }] });
    mockExecute.mockResolvedValue({ ok: true, result: { deleted: 1 } });

    const result = await aiService.resolveApproval('user-1', 'pending-1', { approved: true });

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith('delete_channels', { channelIds: ['c1'] }, expect.any(Object));
    expect(result.steps[0].ok).toBe(true);
  });

  test('an already resolved approval cannot be replayed', async () => {
    mockTables({
      ai_pending_actions: () => builder({ first: { id: 'pending-1', user_id: 'user-1', status: 'approved' } }),
    });
    await expect(aiService.resolveApproval('user-1', 'pending-1', { approved: true }))
      .rejects.toThrow(/zaten sonuçlandırılmış/i);
  });
});

describe('AI message length', () => {
  beforeEach(() => jest.clearAllMocks());

  test('a message far beyond the old 8000 character limit is accepted', async () => {
    const inserts = mockTables();
    providerReplies({ choices: [{ message: { content: 'okudum' } }] });
    mockAttachmentSave.mockResolvedValue({
      id: 'att-1', filename: 'mesaj.txt', format: 'text', kind: 'upload', sizeBytes: 60_000, lineCount: 1, meta: {},
    });

    const result = await aiService.chat('user-1', { message: 'A'.repeat(60_000) });

    // Eski davranis: VALIDATION_ERROR. Yeni davranis: metin eke tasinir.
    expect(result.reply).toBe('okudum');
    expect(mockAttachmentSave).toHaveBeenCalledWith('user-1', expect.objectContaining({ conversationId: 'conv-1' }));
    // Saglayiciya giden govde tam metni degil, kirpilmis halini + ek kimligini tasir.
    const sentBody = JSON.parse(mockSafeFetchText.mock.calls[0][1].body);
    const userMessage = sentBody.messages.at(-1).content;
    expect(userMessage).toContain('attachmentId=att-1');
    expect(userMessage.length).toBeLessThan(60_000);
    // Kaydedilen kullanici mesaji ekin ustverisini tasir.
    const userRow = inserts.ai_messages.find((row) => row.role === 'user');
    expect(JSON.parse(userRow.attachments)).toEqual([expect.objectContaining({ id: 'att-1' })]);
  });

  test('a message beyond the hard ceiling is still rejected', async () => {
    mockTables();
    await expect(aiService.chat('user-1', { message: 'A'.repeat(1_000_001) }))
      .rejects.toThrow(/en fazla/i);
  });

  test('an empty message with no attachment is rejected', async () => {
    mockTables();
    await expect(aiService.chat('user-1', { message: '   ' })).rejects.toThrow(/boş olamaz/i);
  });
});
