const fs = require('fs').promises;

const mockChannelService = {
  _verifyChannelOwnership: jest.fn(),
  update: jest.fn(),
};
jest.mock('../../../src/services/ChannelService', () => mockChannelService);

const mockLogoStorage = {
  getChannelLogoFilename: jest.fn((channelId, extension) => `${channelId}.${extension}`),
  getChannelLogoPath: jest.fn((channelId, extension) => `/tmp/${channelId}.${extension}`),
  buildChannelLogoUrl: jest.fn((channelId, extension) => `/logos/${channelId}.${extension}?v=1700000000000`),
  removeChannelLogoVariants: jest.fn().mockResolvedValue(),
};
jest.mock('../../../src/utils/logoStorage', () => mockLogoStorage);

const channelController = require('../../../src/controllers/channelController');

const USER_ID = 'user-1';
const CHANNEL_ID = '11111111-1111-4111-8111-111111111111';
const LOGO_URL = `/logos/${CHANNEL_ID}.png?v=1700000000000`;

describe('channelController uploadLogo storage lifecycle', () => {
  beforeEach(() => jest.clearAllMocks());

  test('writes the canonical filename and removes old variants through logo storage', async () => {
    const mkdirSpy = jest.spyOn(fs, 'mkdir').mockResolvedValue();
    const writeSpy = jest.spyOn(fs, 'writeFile').mockResolvedValue();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    mockChannelService._verifyChannelOwnership.mockResolvedValue({ id: CHANNEL_ID });
    mockChannelService.update.mockResolvedValue({ id: CHANNEL_ID, logo_url: LOGO_URL });
    const req = {
      userId: USER_ID,
      params: { id: CHANNEL_ID.toUpperCase() },
      body: { imageData: `data:image/png;base64,${png.toString('base64')}` },
    };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await channelController.uploadLogo(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockChannelService._verifyChannelOwnership).toHaveBeenCalledWith(USER_ID, CHANNEL_ID.toUpperCase());
    expect(mockLogoStorage.getChannelLogoPath).toHaveBeenCalledWith(CHANNEL_ID, 'png');
    expect(mockLogoStorage.removeChannelLogoVariants).toHaveBeenCalledWith(CHANNEL_ID, 'png');
    expect(mockLogoStorage.buildChannelLogoUrl).toHaveBeenCalledWith(CHANNEL_ID, 'png');
    expect(mockChannelService.update).toHaveBeenCalledWith(USER_ID, CHANNEL_ID, { logo_url: LOGO_URL });
    expect(writeSpy).toHaveBeenCalledWith(`/tmp/${CHANNEL_ID}.png`, png, { flag: 'w', mode: 0o640 });
    expect(res.json).toHaveBeenCalledWith({ id: CHANNEL_ID, logo_url: LOGO_URL });
    mkdirSpy.mockRestore();
    writeSpy.mockRestore();
  });

  test('stores by the sniffed type even when the browser reports a different image mime', async () => {
    const mkdirSpy = jest.spyOn(fs, 'mkdir').mockResolvedValue();
    const writeSpy = jest.spyOn(fs, 'writeFile').mockResolvedValue();
    // `.jpg` uzantili bir PNG secildiginde tarayici `image/jpeg` bildirir;
    // yukleme bu yuzden reddedilmemeli, icerik imzasi belirleyici olmali.
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    mockChannelService._verifyChannelOwnership.mockResolvedValue({ id: CHANNEL_ID });
    mockChannelService.update.mockResolvedValue({ id: CHANNEL_ID, logo_url: LOGO_URL });
    const req = {
      userId: USER_ID,
      params: { id: CHANNEL_ID },
      body: { imageData: `data:image/jpeg;base64,${png.toString('base64')}` },
    };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await channelController.uploadLogo(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockLogoStorage.getChannelLogoPath).toHaveBeenCalledWith(CHANNEL_ID, 'png');
    expect(mockLogoStorage.buildChannelLogoUrl).toHaveBeenCalledWith(CHANNEL_ID, 'png');
    mkdirSpy.mockRestore();
    writeSpy.mockRestore();
  });

  test('rejects a payload whose bytes are not a supported image', async () => {
    const mkdirSpy = jest.spyOn(fs, 'mkdir').mockResolvedValue();
    const writeSpy = jest.spyOn(fs, 'writeFile').mockResolvedValue();
    const req = {
      userId: USER_ID,
      params: { id: CHANNEL_ID },
      body: { imageData: `data:image/png;base64,${Buffer.from('<svg/>').toString('base64')}` },
    };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await channelController.uploadLogo(req, res, next);

    expect(writeSpy).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0].code).toBe('VALIDATION_ERROR');
    mkdirSpy.mockRestore();
    writeSpy.mockRestore();
  });
});
