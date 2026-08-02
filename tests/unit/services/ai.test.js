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
  definitions: () => [{ type: 'function', function: { name: 'list_playlists', description: 'x', parameters: { type: 'object', properties: {} } } }],
  execute: (...args) => mockExecute(...args),
  isDestructive: (name) => name === 'delete_channels',
  names: ['list_playlists', 'delete_channels'],
}));

const aiService = require('../../../src/services/AIService');
const { decrypt } = require('../../../src/utils/crypto');

function builder({ rows = [], first, returning = [] } = {}) {
  const query = {};
  for (const method of ['where', 'andWhere', 'orderBy', 'select', 'limit', 'insert', 'update', 'del', 'join']) {
    query[method] = jest.fn(() => query);
  }
  query.first = jest.fn().mockResolvedValue(first);
  query.returning = jest.fn().mockResolvedValue(returning);
  query.then = (resolve, reject) => Promise.resolve(rows).then(resolve, reject);
  return query;
}

/** Saglayici cevaplarini sirayla dondurur. */
function respondWith(...payloads) {
  for (const payload of payloads) {
    mockSafeFetchText.mockResolvedValueOnce({ text: JSON.stringify(payload) });
  }
}

const CONFIGURED = { user_id: 'user-1', base_url: 'https://api.openai.com/v1', api_key_enc: require('../../../src/utils/crypto').encrypt('sk-test'), model: 'gpt-4o-mini', temperature: '0.2', max_steps: 5, allow_destructive: true };

describe('AIService settings', () => {
  beforeEach(() => jest.clearAllMocks());

  test('stores the API key encrypted and never returns it', async () => {
    const settings = builder({ first: undefined });
    mockDb.mockReturnValue(settings);

    await aiService.saveSettings('user-1', { baseUrl: 'https://api.openai.com/v1/', apiKey: 'sk-secret', model: 'gpt-4o' });

    const inserted = settings.insert.mock.calls[0][0];
    expect(inserted.api_key_enc).toMatch(/^enc:v1:/);
    expect(decrypt(inserted.api_key_enc)).toBe('sk-secret');
    // Sondaki egik cizgi normalize edilir
    expect(inserted.base_url).toBe('https://api.openai.com/v1');
  });

  test('getSettings reports key presence without exposing it', async () => {
    mockDb.mockReturnValue(builder({ first: CONFIGURED }));
    const settings = await aiService.getSettings('user-1');
    expect(settings).toMatchObject({ hasApiKey: true, configured: true, model: 'gpt-4o-mini' });
    expect(JSON.stringify(settings)).not.toContain('sk-test');
  });

  test('rejects a base URL without a scheme', async () => {
    mockDb.mockReturnValue(builder({ first: undefined }));
    await expect(aiService.saveSettings('user-1', { baseUrl: 'api.openai.com/v1' }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('lists provider models from the OpenAI shape', async () => {
    mockDb.mockReturnValue(builder({ first: CONFIGURED }));
    respondWith({ data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] });

    await expect(aiService.listModels('user-1')).resolves.toEqual(['gpt-4o', 'gpt-4o-mini']);
    const [url, options] = mockSafeFetchText.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/models');
    expect(options.headers.authorization).toBe('Bearer sk-test');
  });

  test('maps provider auth failures to a readable error', async () => {
    mockDb.mockReturnValue(builder({ first: CONFIGURED }));
    mockSafeFetchText.mockRejectedValueOnce(Object.assign(new Error('HTTP 401'), { remoteStatus: 401 }));
    await expect(aiService.listModels('user-1')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('AIService chat loop', () => {
  beforeEach(() => jest.clearAllMocks());

  function wireConversation({ settings = CONFIGURED } = {}) {
    const settingsQuery = builder({ first: settings });
    const conversations = builder({ returning: [{ id: 'conv-1', user_id: 'user-1' }] });
    const messages = builder({ rows: [] });
    mockDb.mockImplementation((table) => {
      if (table === 'ai_settings') return settingsQuery;
      if (table === 'ai_conversations') return conversations;
      if (table === 'ai_messages') return messages;
      return builder({ first: { id: 'p1', name: 'Ana Liste' } });
    });
    return { conversations, messages };
  }

  test('refuses to run before the provider is configured', async () => {
    mockDb.mockReturnValue(builder({ first: { user_id: 'user-1', api_key_enc: null } }));
    await expect(aiService.chat('user-1', { message: 'merhaba' }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('executes the requested tool and returns the final reply', async () => {
    const { messages } = wireConversation();
    mockExecute.mockResolvedValue({ ok: true, result: { total: 2 } });
    respondWith(
      { choices: [{ message: { content: null, tool_calls: [{ id: 'call-1', function: { name: 'list_playlists', arguments: '{}' } }] } }] },
      { choices: [{ message: { content: '2 liste buldum.' } }], usage: { prompt_tokens: 10, completion_tokens: 4 } }
    );

    const result = await aiService.chat('user-1', { message: 'listelerimi göster', playlistId: 'p1' });

    expect(mockExecute).toHaveBeenCalledWith('list_playlists', {}, expect.objectContaining({ userId: 'user-1', playlistId: 'p1' }));
    expect(result.reply).toBe('2 liste buldum.');
    expect(result.steps).toEqual([expect.objectContaining({ tool: 'list_playlists', ok: true })]);
    // Kullanici, asistan, arac ve son asistan mesaji kalici olarak yazilir
    expect(messages.insert).toHaveBeenCalledTimes(4);
  });

  test('passes the destructive permission through to the tools', async () => {
    wireConversation();
    mockExecute.mockResolvedValue({ ok: true, result: { deleted: 3 } });
    respondWith(
      { choices: [{ message: { tool_calls: [{ id: 'call-1', function: { name: 'delete_channels', arguments: '{"channelIds":["a"]}' } }] } }] },
      { choices: [{ message: { content: 'Silindi.' } }] }
    );

    const result = await aiService.chat('user-1', { message: 'sil', allowDestructive: false });
    expect(mockExecute).toHaveBeenCalledWith('delete_channels', { channelIds: ['a'] }, expect.objectContaining({ allowDestructive: false }));
    expect(result.steps[0].destructive).toBe(true);
  });

  test('reports invalid tool arguments back to the model instead of throwing', async () => {
    wireConversation();
    respondWith(
      { choices: [{ message: { tool_calls: [{ id: 'call-1', function: { name: 'list_playlists', arguments: '{not json' } }] } }] },
      { choices: [{ message: { content: 'Tekrar deniyorum.' } }] }
    );

    const result = await aiService.chat('user-1', { message: 'dene' });
    expect(mockExecute).not.toHaveBeenCalled();
    expect(result.steps[0]).toMatchObject({ ok: false });
  });

  test('stops at the configured step limit', async () => {
    wireConversation({ settings: { ...CONFIGURED, max_steps: 2 } });
    mockExecute.mockResolvedValue({ ok: true, result: {} });
    respondWith(
      { choices: [{ message: { tool_calls: [{ id: 'c1', function: { name: 'list_playlists', arguments: '{}' } }] } }] },
      { choices: [{ message: { tool_calls: [{ id: 'c2', function: { name: 'list_playlists', arguments: '{}' } }] } }] }
    );

    const result = await aiService.chat('user-1', { message: 'döngü' });
    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(result.reply).toMatch(/Adım sınırına/);
  });

  test('rejects empty and oversized messages', async () => {
    await expect(aiService.chat('user-1', { message: '   ' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(aiService.chat('user-1', { message: 'a'.repeat(9000) })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
