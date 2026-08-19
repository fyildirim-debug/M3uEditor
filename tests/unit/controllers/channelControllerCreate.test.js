const mockDb = jest.fn();
jest.mock('../../../src/config/database', () => mockDb);

const mockChannelService = {
  _verifyCategoryForPlaylist: jest.fn(),
};
jest.mock('../../../src/services/ChannelService', () => mockChannelService);

const channelController = require('../../../src/controllers/channelController');

const USER_ID = 'user-1';
const PLAYLIST_ID = 'playlist-1';
const STREAM_URL = 'http://example.com/live/1.m3u8';

/**
 * `db('channels')` hem yinelenen kanal aramasi, hem en buyuk sort_order
 * sorgusu, hem de insert icin kullaniliyor. Knex her cagrida yeni bir
 * olusturucu dondurdugu icin sahte de oyle davraniyor; ortak durum disarida
 * tutuluyor.
 */
function createChannelsTable({ duplicate = null, insertImpl = null } = {}) {
  const state = {
    inserted: null,
    insertCalls: 0,
    duplicate,
    lookups: 0,
  };
  state.table = () => {
    const builder = { isMaxQuery: false };
    builder.where = jest.fn(() => builder);
    builder.max = jest.fn(() => { builder.isMaxQuery = true; return builder; });
    builder.first = jest.fn(async () => {
      if (builder.isMaxQuery) return { max: 7 };
      state.lookups += 1;
      return typeof state.duplicate === 'function' ? state.duplicate(state) : state.duplicate;
    });
    builder.insert = jest.fn((row) => {
      state.insertCalls += 1;
      state.inserted = row;
      return { returning: async () => (insertImpl ? insertImpl(row) : [{ ...row }]) };
    });
    return builder;
  };
  return state;
}

function setupDb(channels, playlist = { id: PLAYLIST_ID, user_id: USER_ID }) {
  mockDb.mockImplementation((table) => {
    if (table === 'playlists') return { where: () => ({ first: async () => playlist }) };
    if (table === 'channels') return channels.table();
    throw new Error(`Unexpected table: ${table}`);
  });
}

function buildRequest(body = {}) {
  return {
    userId: USER_ID,
    params: { id: PLAYLIST_ID },
    body: { name: '  Kanal 1  ', streamUrl: `  ${STREAM_URL}  `, ...body },
  };
}

describe('channelController createChannel', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates the channel with trimmed values when the stream url is new', async () => {
    const channels = createChannelsTable();
    setupDb(channels);
    const res = { status: jest.fn(() => res), json: jest.fn() };
    const next = jest.fn();

    await channelController.createChannel(buildRequest({ logoUrl: ' https://cdn.example.com/a.png ' }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(channels.inserted).toMatchObject({
      playlist_id: PLAYLIST_ID,
      name: 'Kanal 1',
      original_name: 'Kanal 1',
      stream_url: STREAM_URL,
      logo_url: 'https://cdn.example.com/a.png',
      original_logo_url: 'https://cdn.example.com/a.png',
      sort_order: 8,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('rejects a stream url that already exists in the playlist with a named 409', async () => {
    const channels = createChannelsTable({ duplicate: { id: 'existing-1', name: 'Var Olan Kanal' } });
    setupDb(channels);
    const res = { status: jest.fn(() => res), json: jest.fn() };
    const next = jest.fn();

    await channelController.createChannel(buildRequest(), res, next);

    expect(channels.insertCalls).toBe(0);
    expect(res.json).not.toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.code).toBe('DUPLICATE_CHANNEL');
    expect(error.statusCode).toBe(409);
    expect(error.message).toContain('Var Olan Kanal');
  });

  test('translates a unique violation raised by a concurrent insert into the same 409', async () => {
    const channels = createChannelsTable({
      // Yinelenen kayit ilk kontrolden sonra olustu: yalnizca hatadan sonraki
      // arama onu buluyor.
      duplicate: (state) => (state.insertCalls ? { id: 'existing-1', name: 'Yaris Kanali' } : null),
      insertImpl: () => { const error = new Error('duplicate key'); error.code = '23505'; throw error; },
    });
    setupDb(channels);
    const res = { status: jest.fn(() => res), json: jest.fn() };
    const next = jest.fn();

    await channelController.createChannel(buildRequest(), res, next);

    const error = next.mock.calls[0][0];
    expect(error.code).toBe('DUPLICATE_CHANNEL');
    expect(error.statusCode).toBe(409);
    expect(error.message).toContain('Yaris Kanali');
  });
});
