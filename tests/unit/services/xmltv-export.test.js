const mockDb = jest.fn();
mockDb.raw = jest.fn();
jest.mock('../../../src/config/database', () => mockDb);

const xmltvExportService = require('../../../src/services/XMLTVExportService');

function ownershipChain(playlist = { id: 'playlist-1', user_id: 'user-1' }) {
  return {
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(playlist),
  };
}

async function read(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk.toString());
  return chunks.join('');
}

describe('XMLTVExportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each(['0', '15', '-1', '1.5', 'abc', ['7']])('rejects invalid days value %p', (days) => {
    expect(() => xmltvExportService.normalizeDays(days)).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  test('defaults days to 7 and accepts the inclusive 1-14 range', () => {
    expect(xmltvExportService.normalizeDays()).toBe(7);
    expect(xmltvExportService.normalizeDays('1')).toBe(1);
    expect(xmltvExportService.normalizeDays(14)).toBe(14);
  });

  test('checks ownership, selects matched channels and streams in-horizon programmes', async () => {
    mockDb.mockReturnValue(ownershipChain());
    mockDb.raw
      .mockResolvedValueOnce({ rows: [{
        channel_id: 'guide.same.id',
        name: 'A & B',
        icon_url: null,
        epg_channel_uuid: '11111111-1111-4111-8111-111111111111',
      }] })
      .mockResolvedValueOnce({ rows: [{
        id: '22222222-2222-4222-8222-222222222222',
        start_time: new Date('2026-07-28T10:00:00Z'),
        end_time: new Date('2026-07-28T11:00:00Z'),
        title: 'Programme <One>',
        description: 'Description & more',
        channel_id: 'guide.same.id',
      }] });

    const stream = await xmltvExportService.createAuthenticatedStream('user-1', 'playlist-1', '3');
    const xml = await read(stream);

    expect(xml).toContain('<channel id="guide.same.id">');
    expect(xml).toContain('<programme start="20260728100000 +0000" stop="20260728110000 +0000" channel="guide.same.id">');
    expect(xml).toContain('Programme &lt;One&gt;');
    expect(mockDb().where).toHaveBeenCalledWith({ id: 'playlist-1', user_id: 'user-1' });
    expect(mockDb.raw.mock.calls[1][0]).toContain('ANY(?::uuid[])');
  });

  test('uses keyset batches instead of accumulating all programmes', async () => {
    const channelUuid = '11111111-1111-4111-8111-111111111111';
    const firstBatch = Array.from({ length: 1000 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      start_time: new Date('2026-07-28T10:00:00Z'),
      end_time: new Date('2026-07-28T11:00:00Z'),
      title: `Programme ${index}`,
      description: null,
      channel_id: 'batch.id',
    }));
    mockDb.mockReturnValue(ownershipChain());
    mockDb.raw
      .mockResolvedValueOnce({ rows: [{ channel_id: 'batch.id', name: 'Batch', icon_url: null, epg_channel_uuid: channelUuid }] })
      .mockResolvedValueOnce({ rows: firstBatch })
      .mockResolvedValueOnce({ rows: [{
        id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        start_time: new Date('2026-07-28T10:01:00Z'),
        end_time: new Date('2026-07-28T11:01:00Z'),
        title: 'Last programme',
        description: null,
        channel_id: 'batch.id',
      }] });

    const xml = await read(await xmltvExportService.createAuthenticatedStream('user-1', 'playlist-1', 7));

    expect(xml.match(/<programme /g)).toHaveLength(1001);
    expect(mockDb.raw).toHaveBeenCalledTimes(3);
    expect(mockDb.raw.mock.calls[2][0]).toContain('p.start_time > ?');
    expect(mockDb.raw.mock.calls[2][1]).toEqual(expect.arrayContaining([
      firstBatch[999].id,
      firstBatch[999].start_time,
    ]));
  });

  test('returns coverage counts after ownership validation', async () => {
    mockDb.mockReturnValue(ownershipChain());
    mockDb.raw.mockResolvedValue({ rows: [{
      total_channels: 4,
      matched_channels: 3,
      channels_with_programs: 2,
    }] });

    await expect(xmltvExportService.getCoverage('user-1', 'playlist-1')).resolves.toEqual({
      totalChannels: 4,
      matchedChannels: 3,
      channelsWithPrograms: 2,
    });
  });

  test('does not disclose another user playlist', async () => {
    mockDb.mockReturnValue(ownershipChain(null));
    await expect(xmltvExportService.createAuthenticatedStream('user-1', 'foreign', 7))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mockDb.raw).not.toHaveBeenCalled();
  });
});
