const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const config = require('../../../src/config');
const logger = require('../../../src/config/logger');
const {
  getChannelLogoFilename,
  getChannelLogoPath,
  buildChannelLogoUrl,
  stripLogoUrlVersion,
  removeChannelLogoVariants,
  removeChannelLogos,
} = require('../../../src/utils/logoStorage');

const CHANNEL_ID = '11111111-1111-4111-8111-111111111111';

describe('logoStorage', () => {
  let originalUploadDir;
  let uploadDir;

  beforeEach(async () => {
    originalUploadDir = config.uploadDir;
    uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'm3u-logo-storage-'));
    config.uploadDir = uploadDir;
  });

  afterEach(async () => {
    config.uploadDir = originalUploadDir;
    await fs.rm(uploadDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test('builds paths only from canonical UUIDs and allowed extensions', () => {
    expect(getChannelLogoFilename(CHANNEL_ID.toUpperCase(), 'PNG')).toBe(`${CHANNEL_ID}.png`);
    expect(getChannelLogoPath(CHANNEL_ID, 'webp')).toBe(path.join(uploadDir, `${CHANNEL_ID}.webp`));
    expect(() => getChannelLogoPath('../../etc/passwd', 'png')).toThrow(TypeError);
    expect(() => getChannelLogoPath(CHANNEL_ID, '../png')).toThrow(TypeError);
  });

  test('removes every allowed variant and silently accepts missing files', async () => {
    await Promise.all(['png', 'jpg', 'gif', 'webp'].map((extension) => fs.writeFile(
      path.join(uploadDir, `${CHANNEL_ID}.${extension}`),
      extension
    )));

    await expect(removeChannelLogos([CHANNEL_ID])).resolves.toBeUndefined();
    await expect(removeChannelLogos([CHANNEL_ID])).resolves.toBeUndefined();
    await expect(fs.readdir(uploadDir)).resolves.toEqual([]);
  });

  test('preserves the freshly uploaded extension while removing old variants', async () => {
    await fs.writeFile(path.join(uploadDir, `${CHANNEL_ID}.png`), 'new');
    await fs.writeFile(path.join(uploadDir, `${CHANNEL_ID}.jpg`), 'old');

    await removeChannelLogoVariants(CHANNEL_ID, 'png');

    await expect(fs.readFile(path.join(uploadDir, `${CHANNEL_ID}.png`), 'utf8')).resolves.toBe('new');
    await expect(fs.access(path.join(uploadDir, `${CHANNEL_ID}.jpg`))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('logs unlink failures without rejecting the caller', async () => {
    // Dosya gercekten var ki readdir taramasi onu bulup unlink'e yönlendirsin
    await fs.writeFile(path.join(uploadDir, `${CHANNEL_ID}.png`), 'logo');
    const unlinkSpy = jest.spyOn(fs, 'unlink').mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'EACCES' }));
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    await expect(removeChannelLogoVariants(CHANNEL_ID, 'jpg')).resolves.toBeUndefined();

    expect(unlinkSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.objectContaining({ channelId: CHANNEL_ID }), expect.any(String));
  });

  test('stamps uploaded logo urls so an immutable cache cannot serve the previous image', () => {
    const first = buildChannelLogoUrl(CHANNEL_ID, 'png', 1);
    const second = buildChannelLogoUrl(CHANNEL_ID, 'png', 2);

    expect(first).toBe(`/logos/${CHANNEL_ID}.png?v=1`);
    expect(second).not.toBe(first);
    expect(buildChannelLogoUrl(CHANNEL_ID.toUpperCase(), 'PNG', 3)).toBe(`/logos/${CHANNEL_ID}.png?v=3`);
  });

  test('strips the version stamp back to the stored file path', () => {
    expect(stripLogoUrlVersion(`/logos/${CHANNEL_ID}.png?v=1700000000000`)).toBe(`/logos/${CHANNEL_ID}.png`);
    expect(stripLogoUrlVersion(`/logos/${CHANNEL_ID}.png`)).toBe(`/logos/${CHANNEL_ID}.png`);
    expect(stripLogoUrlVersion(null)).toBe('');
  });
});
