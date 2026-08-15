/**
 * Ek dosyasi araclarinin servis katmanina dogru bagli oldugunu dogrular.
 *
 * Sahteler gercek modullerin BICIMINI taklit eder: ImportService bir sinif
 * olarak, ExportService ise hazir bir ornek olarak disa aciliyor. Bu ayrim
 * onemli — araclarin ilk surumu ImportService'i orneklemeden cagiriyordu ve
 * `import_attachment` calisma aninda "is not a function" ile patliyordu.
 */

const mockImportFromM3U = jest.fn();
jest.mock('../../../src/services/ImportService', () => (
  class ImportService {
    importFromM3U(...args) { return mockImportFromM3U(...args); }
  }
));

const mockExportAsM3U = jest.fn();
jest.mock('../../../src/services/ExportService', () => ({
  exportAsM3U: (...args) => mockExportAsM3U(...args),
}));

const mockStore = {
  list: jest.fn(),
  require: jest.fn(),
  readRaw: jest.fn(),
  readWindow: jest.fn(),
  search: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  rowToPublic: (row) => row,
};
jest.mock('../../../src/services/ai/attachments', () => mockStore);

const attachmentTools = require('../../../src/services/ai/tools/attachments');

const CTX = { userId: 'user-1', conversationId: 'conv-1', playlistId: 'pl-1', allowDestructive: true };
const M3U_ROW = { id: 'att-1', user_id: 'user-1', filename: 'liste.m3u', format: 'm3u' };

describe('AI attachment tools', () => {
  beforeEach(() => jest.clearAllMocks());

  test('import_attachment hands the file to the import service', async () => {
    mockStore.readRaw.mockResolvedValue({ row: M3U_ROW, content: '#EXTM3U\n#EXTINF:-1,A\nhttp://x' });
    mockImportFromM3U.mockResolvedValue({ playlistId: 'pl-9', totalChannels: 1 });

    const result = await attachmentTools.import_attachment.run({ attachmentId: 'att-1', playlistName: 'Yeni' }, CTX);

    expect(mockImportFromM3U).toHaveBeenCalledWith('user-1', '#EXTM3U\n#EXTINF:-1,A\nhttp://x', null, 'Yeni', undefined);
    expect(result).toMatchObject({ totalChannels: 1, source: { attachmentId: 'att-1' } });
  });

  test('import_attachment refuses a non-M3U file instead of guessing', async () => {
    mockStore.readRaw.mockResolvedValue({ row: { ...M3U_ROW, format: 'xmltv' }, content: '<tv></tv>' });

    await expect(attachmentTools.import_attachment.run({ attachmentId: 'att-1' }, CTX))
      .rejects.toThrow(/yalnızca M3U/i);
    expect(mockImportFromM3U).not.toHaveBeenCalled();
  });

  test('export_playlist_to_file writes the export as a downloadable file', async () => {
    mockExportAsM3U.mockResolvedValue('#EXTM3U\n');
    mockStore.save.mockResolvedValue({ id: 'out-1', filename: 'liste.m3u', sizeBytes: 9, meta: { entryCount: 0 } });

    const result = await attachmentTools.export_playlist_to_file.run({ streamType: 'live' }, CTX);

    expect(mockExportAsM3U).toHaveBeenCalledWith('user-1', 'pl-1', [], 'live', null);
    expect(mockStore.save).toHaveBeenCalledWith('user-1', expect.objectContaining({ kind: 'output', format: 'm3u', conversationId: 'conv-1' }));
    expect(result.attachmentId).toBe('out-1');
  });

  test('save_output_file stores the assistant text as an output file', async () => {
    mockStore.save.mockResolvedValue({ id: 'out-2', filename: 'rapor.csv', sizeBytes: 20, meta: {} });

    const result = await attachmentTools.save_output_file.run({ filename: 'rapor.csv', content: 'ad,durum\n' }, CTX);

    expect(mockStore.save).toHaveBeenCalledWith('user-1', expect.objectContaining({ kind: 'output', content: 'ad,durum\n' }));
    expect(result.attachmentId).toBe('out-2');
  });

  test('tools fall back to the latest upload when no id is given', async () => {
    mockStore.list.mockResolvedValue([{ id: 'att-son' }]);
    mockStore.readWindow.mockResolvedValue({ attachmentId: 'att-son' });

    await attachmentTools.read_attachment.run({ startLine: 1 }, CTX);

    expect(mockStore.list).toHaveBeenCalledWith('user-1', expect.objectContaining({ conversationId: 'conv-1', kind: 'upload' }));
    expect(mockStore.readWindow).toHaveBeenCalledWith('user-1', 'att-son', expect.any(Object));
  });

  test('a conversation with no upload says so instead of failing obscurely', async () => {
    mockStore.list.mockResolvedValue([]);
    await expect(attachmentTools.describe_attachment.run({}, CTX)).rejects.toThrow(/dosya yok/i);
  });

  test('delete_attachment is marked destructive so the permission gate applies', () => {
    expect(attachmentTools.delete_attachment.destructive).toBe(true);
    expect(attachmentTools.import_attachment.destructive).toBeUndefined();
  });
});
