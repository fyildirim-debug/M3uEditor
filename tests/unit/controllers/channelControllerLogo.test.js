const fs = require('fs').promises;

const mockChannelService = {
  _verifyChannelOwnership: jest.fn(),
  update: jest.fn(),
};
jest.mock('../../../src/services/ChannelService', () => mockChannelService);

const mockLogoStorage = {
  getChannelLogoFilename: jest.fn((channelId, extension) => `${channelId}.${extension}`),
  getChannelLogoPath: jest.fn((channelId, extension) => `/tmp/${channelId}.${extension}`),
  removeChannelLogoVariants: jest.fn().mockResolvedValue(),
};
jest.mock('../../../src/utils/logoStorage', () => mockLogoStorage);

const channelController = require('../../../src/controllers/channelController');

const USER_ID = 'user-1';
const CHANNEL_ID = '11111111-1111-4111-8111-111111111111';

describe('channelController uploadLogo storage lifecycle', () => {
  beforeEach(() => jest.clearAllMocks());

  test('writes the canonical filename and removes old variants through logo storage', async () => {
    const mkdirSpy = jest.spyOn(fs, 'mkdir').mockResolvedValue();
    const writeSpy = jest.spyOn(fs, 'writeFile').mockResolvedValue();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    mockChannelService._verifyChannelOwnership.mockResolvedValue({ id: CHANNEL_ID });
    mockChannelService.update.mockResolvedValue({ id: CHANNEL_ID, logo_url: `/logos/${CHANNEL_ID}.png` });
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
    expect(mockChannelService.update).toHaveBeenCalledWith(USER_ID, CHANNEL_ID, {
      logo_url: `/logos/${CHANNEL_ID}.png`,
    });
    expect(writeSpy).toHaveBeenCalledWith(`/tmp/${CHANNEL_ID}.png`, png, { flag: 'w', mode: 0o640 });
    expect(res.json).toHaveBeenCalledWith({ id: CHANNEL_ID, logo_url: `/logos/${CHANNEL_ID}.png` });
    mkdirSpy.mockRestore();
    writeSpy.mockRestore();
  });
});
