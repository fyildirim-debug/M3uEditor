const fs = require('fs').promises;
const os = require('os');
const path = require('path');

const mockDb = jest.fn();
mockDb.destroy = jest.fn().mockResolvedValue();
jest.mock('../../../src/config/database', () => mockDb);

const config = require('../../../src/config');
const { parseMode, scanLogoFiles, findOrphans } = require('../../../scripts/cleanup-logos');

const ACTIVE_ID = '11111111-1111-4111-8111-111111111111';
const ORPHAN_ID = '22222222-2222-4222-8222-222222222222';

describe('cleanup-logos CLI', () => {
  let originalUploadDir;
  let uploadDir;

  beforeEach(async () => {
    jest.clearAllMocks();
    originalUploadDir = config.uploadDir;
    uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'm3u-cleanup-logos-'));
    config.uploadDir = uploadDir;
  });

  afterEach(async () => {
    config.uploadDir = originalUploadDir;
    await fs.rm(uploadDir, { recursive: true, force: true });
  });

  test('defaults to dry-run and requires an explicit valid delete flag', () => {
    expect(parseMode([])).toBe('dry-run');
    expect(parseMode(['--dry-run'])).toBe('dry-run');
    expect(parseMode(['--delete'])).toBe('delete');
    expect(() => parseMode(['--delete', '--dry-run'])).toThrow(/Kullanım/);
    expect(() => parseMode(['--force'])).toThrow(/Kullanım/);
  });

  test('reports only managed UUID logo files whose exact URL is absent from the database', async () => {
    await fs.writeFile(path.join(uploadDir, `${ACTIVE_ID}.png`), 'active');
    await fs.writeFile(path.join(uploadDir, `${ACTIVE_ID}.jpg`), 'stale-variant');
    await fs.writeFile(path.join(uploadDir, `${ORPHAN_ID}.webp`), 'orphan');
    await fs.writeFile(path.join(uploadDir, 'notes.txt'), 'unmanaged');

    const query = {};
    query.whereIn = jest.fn(() => query);
    query.select = jest.fn(() => query);
    query.then = (resolve, reject) => Promise.resolve([
      { id: ACTIVE_ID, logo_url: `/logos/${ACTIVE_ID}.png` },
    ]).then(resolve, reject);
    mockDb.mockReturnValue(query);

    const files = await scanLogoFiles();
    const orphans = await findOrphans(files);

    expect(files.map((file) => file.filename).sort()).toEqual([
      `${ACTIVE_ID}.jpg`, `${ACTIVE_ID}.png`, `${ORPHAN_ID}.webp`,
    ]);
    expect(orphans.map((file) => file.filename).sort()).toEqual([
      `${ACTIVE_ID}.jpg`, `${ORPHAN_ID}.webp`,
    ]);
  });
});
