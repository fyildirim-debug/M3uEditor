const mockDb = jest.fn();
mockDb.fn = { now: jest.fn().mockReturnValue('NOW()') };
mockDb.raw = jest.fn();
jest.mock('../../../src/config/database', () => mockDb);

const mockExportService = { createXtreamPlaylist: jest.fn() };
const mockXmltvExportService = { createSharedStream: jest.fn() };
jest.mock('../../../src/services/ExportService', () => mockExportService);
jest.mock('../../../src/services/XMLTVExportService', () => mockXmltvExportService);

const crypto = require('crypto');
const { hashToken, encrypt } = require('../../../src/utils/crypto');
const xtreamOutputService = require('../../../src/services/XtreamOutputService');

function firstQuery(value) {
  // Kisa baglanti kolonlari sonradan eklendi: bos gelen kayitlarda ilk okumada
  // doldurulur, bu yuzden okuma sahtesi de update zincirini karsilar.
  const query = {
    where: jest.fn(() => query),
    first: jest.fn().mockResolvedValue(value),
    update: jest.fn(() => query),
    returning: jest.fn().mockResolvedValue([{ id: 'playlist-1' }]),
  };
  return query;
}

function resultQuery(value) {
  const query = {
    join: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    orderByRaw: jest.fn().mockReturnThis(),
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
  return query;
}

describe('XtreamOutputService', () => {
  const playlist = {
    id: 'playlist-1',
    user_id: 'user-1',
    output_username: 'existing-user',
    output_password_hash: hashToken('correct-password'),
    output_enabled: true,
    output_created_at: new Date('2026-07-28T10:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_URL = 'https://iptv.example.test/base/';
  });

  afterAll(() => {
    delete process.env.APP_URL;
  });

  test('enables output with unpredictable credentials and only stores the password hash', async () => {
    const ownership = firstQuery({ id: 'playlist-1', user_id: 'user-1' });
    const returning = jest.fn().mockResolvedValue([{ id: 'playlist-1' }]);
    const updateQuery = {
      where: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnValue({ returning }),
    };
    mockDb.mockReturnValueOnce(ownership).mockReturnValueOnce(updateQuery);

    const response = await xtreamOutputService.enable('user-1', 'playlist-1');

    expect(response.enabled).toBe(true);
    expect(response.username.length).toBeGreaterThanOrEqual(12);
    expect(response.password.length).toBeGreaterThanOrEqual(24);
    expect(response.serverUrl).toBe('https://iptv.example.test/base');
    expect(response.playerApiUrl).toContain(`username=${encodeURIComponent(response.username)}`);
    expect(response.playerApiUrl).toContain(`password=${encodeURIComponent(response.password)}`);
    const update = updateQuery.update.mock.calls[0][0];
    expect(update.output_password_hash).toBe(hashToken(response.password));
    expect(update.output_password_hash).not.toContain(response.password);
    // Arayuzde goruntuleme icin sifre ayrica sifreli saklanir
    expect(update.output_password_enc).toBeDefined();
    expect(update.output_password_enc).not.toContain(response.password);
  });

  test('configuration returns null password for legacy records without encrypted password', async () => {
    mockDb.mockReturnValue(firstQuery(playlist));

    const response = await xtreamOutputService.getConfiguration('user-1', 'playlist-1');

    // Sifre gorunurlugu oncesi kayitlarda enc kolonu yok: sifre null, URL'ler sifresiz
    expect(response.password).toBeNull();
    expect(response.playerApiUrl).toBe('https://iptv.example.test/player_api.php?username=existing-user');
    expect(response.xmltvUrl).not.toContain('password');
    expect(response.m3uUrl).not.toContain('password');
    // Kolonlar sonradan eklendigi icin eski cikislarda kisa adres yoktur;
    // ilk okumada uretilip kaydedilir, kullanici "yenile" demek zorunda kalmaz.
    expect(response.m3uShortUrl).toContain('/m3u.php?id=');
  });

  test('configuration exposes the decrypted password and embeds it in urls when stored encrypted', async () => {
    mockDb.mockReturnValue(firstQuery({ ...playlist, output_password_enc: encrypt('correct-password') }));

    const response = await xtreamOutputService.getConfiguration('user-1', 'playlist-1');

    expect(response.password).toBe('correct-password');
    expect(response.playerApiUrl).toContain('password=correct-password');
    expect(response.m3uUrl).toContain('password=correct-password');
    expect(response.xmltvUrl).toContain('password=correct-password');
  });

  test('accepts a matching hash, rejects a wrong password and rejects disabled output', async () => {
    const timingSpy = jest.spyOn(crypto, 'timingSafeEqual');
    mockDb
      .mockReturnValueOnce(firstQuery(playlist))
      .mockReturnValueOnce(firstQuery(playlist))
      .mockReturnValueOnce(firstQuery({ ...playlist, output_enabled: false }));

    await expect(xtreamOutputService.authenticate('existing-user', 'correct-password'))
      .resolves.toMatchObject({ status: 'valid', playlist });
    await expect(xtreamOutputService.authenticate('existing-user', 'wrong-password'))
      .resolves.toEqual({ status: 'invalid', playlist: null });
    await expect(xtreamOutputService.authenticate('existing-user', 'correct-password'))
      .resolves.toEqual({ status: 'disabled', playlist: null });
    expect(timingSpy).toHaveBeenCalledTimes(6);
    timingSpy.mockRestore();
  });

  test('returns the Xtream account and server handshake shape', () => {
    const response = xtreamOutputService.accountResponse(playlist, 'existing-user', 'correct-password');

    expect(response.user_info).toEqual(expect.objectContaining({
      username: 'existing-user',
      password: 'correct-password',
      auth: 1,
      status: 'Active',
      allowed_output_formats: ['ts', 'm3u8'],
      exp_date: null,
    }));
    expect(response.server_info).toEqual(expect.objectContaining({
      url: 'iptv.example.test',
      port: '443',
      https_port: '443',
      server_protocol: 'https',
    }));
  });

  test('returns protocol category and stream shapes with stable numeric IDs', async () => {
    const categoryRows = [{ xtream_id: '41', name: 'Movies', sort_order: 0 }];
    const vodRows = [{
      xtream_id: '9001',
      name: 'Example Movie',
      logo_url: 'https://img.example/movie.jpg',
      epg_channel_id: null,
      stream_url: 'https://provider.example/movie/u/p/1.mkv',
      extras: { rating: '8.4', plot: 'Plot' },
      created_at: new Date('2026-07-28T10:00:00Z'),
      sort_order: 0,
      stream_type: 'vod',
      category_xtream_id: '41',
    }];
    const categoriesQuery = resultQuery(categoryRows);
    const streamsQuery = resultQuery(vodRows);
    mockDb.mockReturnValueOnce(categoriesQuery).mockReturnValueOnce(streamsQuery);

    await expect(xtreamOutputService.getCategories('playlist-1', 'vod')).resolves.toEqual([
      { category_id: '41', category_name: 'Movies', parent_id: 0 },
    ]);
    await expect(xtreamOutputService.getVodStreams('playlist-1')).resolves.toEqual([
      expect.objectContaining({
        num: 1,
        name: 'Example Movie',
        stream_type: 'movie',
        stream_id: 9001,
        category_id: '41',
        container_extension: 'mkv',
        rating: '8.4',
        rating_5based: '4.2',
      }),
    ]);
    expect(categoriesQuery.where).toHaveBeenCalledWith(expect.objectContaining({
      'categories.is_hidden': false,
    }));
    const visibilityFilter = streamsQuery.where.mock.calls.find(([argument]) => typeof argument === 'function');
    expect(visibilityFilter).toBeDefined();
    visibilityFilter[0].call(streamsQuery);
    expect(streamsQuery.whereNull).toHaveBeenCalledWith('channels.category_id');
    expect(streamsQuery.orWhere).toHaveBeenCalledWith('categories.is_hidden', false);
  });

  test('returns one playable synthetic episode for a series row', async () => {
    const row = {
      id: 'channel-1',
      xtream_id: '77',
      name: 'Example Series',
      logo_url: null,
      stream_url: 'https://provider.example/series/u/p/5.mp4',
      stream_type: 'series',
      extras: { plot: 'Series plot', genre: 'Drama' },
      created_at: new Date('2026-07-28T10:00:00Z'),
      category_xtream_id: '9',
    };
    const query = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(row),
    };
    mockDb.mockReturnValue(query);

    const response = await xtreamOutputService.getSeriesInfo('playlist-1', '77');

    expect(response.info).toEqual(expect.objectContaining({ name: 'Example Series', plot: 'Series plot' }));
    expect(response.episodes['1']).toEqual([
      expect.objectContaining({ id: 77, episode_num: 1, title: 'Example Series', container_extension: 'mp4' }),
    ]);
  });

  test('base64 encodes EPG title and description in Xtream listings', async () => {
    const channel = {
      xtream_id: '12',
      stream_type: 'live',
      epg_channel_id: 'news.example',
      epg_source_id: null,
    };
    const channelQuery = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(channel),
    };
    mockDb.mockReturnValue(channelQuery);
    mockDb.raw.mockResolvedValue({ rows: [{
      id: 'programme-1',
      start_time: new Date('2026-07-28T10:00:00Z'),
      end_time: new Date('2026-07-28T11:00:00Z'),
      title: 'Akşam Haberleri',
      description: 'Günün özeti',
      channel_id: 'news.example',
    }] });

    const response = await xtreamOutputService.getEpg(playlist, '12', '2', true);

    expect(response.epg_listings[0]).toEqual(expect.objectContaining({
      title: Buffer.from('Akşam Haberleri').toString('base64'),
      description: Buffer.from('Günün özeti').toString('base64'),
      start: '2026-07-28 10:00:00',
      end: '2026-07-28 11:00:00',
    }));
    expect(mockDb.raw.mock.calls[0][1][5]).toBe(2);
  });

  test('delegates M3U and XMLTV generation to existing export services', async () => {
    const stream = { pipe: jest.fn() };
    mockExportService.createXtreamPlaylist.mockResolvedValue('#EXTM3U\n');
    mockXmltvExportService.createSharedStream.mockReturnValue(stream);

    await expect(xtreamOutputService.createM3U(playlist)).resolves.toBe('#EXTM3U\n');
    expect(xtreamOutputService.createXmltvStream(playlist, '7')).toBe(stream);
    expect(mockExportService.createXtreamPlaylist).toHaveBeenCalledWith(playlist);
    expect(mockXmltvExportService.createSharedStream).toHaveBeenCalledWith(playlist, '7');
  });

  // Xtream protokolunde direct_source dolu oldugunda oynatici yayini oradan
  // alir; asistanin oynaticilara kaynak adresi ulastirma yolu bu alan.
  test('live streams carry the provider address as direct_source', async () => {
    mockDb.mockReturnValue(resultQuery([{
      xtream_id: '5',
      name: 'Kanal',
      logo_url: null,
      epg_channel_id: 'k.tr',
      stream_url: 'http://provider.example/live/u/p/5.ts',
      extras: {},
      created_at: new Date('2026-07-28T10:00:00Z'),
      sort_order: 0,
      stream_type: 'live',
      category_xtream_id: '1',
    }]));

    const streams = await xtreamOutputService.getLiveStreams(playlist);
    expect(streams[0].direct_source).toBe('http://provider.example/live/u/p/5.ts');
  });

  // Kaldirilan 'proxy' modu geri sizmamali: eski kolon degeri gonderilse bile
  // direct_source her zaman saglayicinin adresiyle dolar, hicbir kosulda bos
  // birakilip oynatici yerel yola yonlendirilmez.
  test('direct_source stays filled even with the removed proxy flag', async () => {
    mockDb.mockReturnValue(resultQuery([{
      xtream_id: '5',
      name: 'Kanal',
      logo_url: null,
      epg_channel_id: 'k.tr',
      stream_url: 'http://provider.example/live/u/p/5.ts',
      extras: {},
      created_at: new Date('2026-07-28T10:00:00Z'),
      sort_order: 0,
      stream_type: 'live',
      category_xtream_id: '1',
    }]));

    const streams = await xtreamOutputService.getLiveStreams({ ...playlist, output_stream_mode: 'proxy' });
    expect(streams[0].direct_source).toBe('http://provider.example/live/u/p/5.ts');
  });

  // Bir oynatici, film/dizi bilgisinde direct_source bos gelirse yayin adresini
  // server_info'dan kendisi kurar; yani bu sunucunun alan adini yayin adresi
  // sanar. Bilgi yanitlarinin da saglayici adresini tasimasi bu yuzden sart.
  test('vod info hands the provider address to the player instead of leaving it to build a local one', async () => {
    const query = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({
        id: 'channel-1',
        xtream_id: '9001',
        name: 'Example Movie',
        logo_url: null,
        stream_url: 'https://provider.example/movie/u/p/9001.mkv',
        stream_type: 'vod',
        extras: {},
        created_at: new Date('2026-07-28T10:00:00Z'),
        category_xtream_id: '41',
      }),
    };
    mockDb.mockReturnValue(query);

    const response = await xtreamOutputService.getVodInfo('playlist-1', '9001');

    expect(response.movie_data.direct_source).toBe('https://provider.example/movie/u/p/9001.mkv');
    expect(response.movie_data.direct_source).not.toContain('iptv.example.test');
  });

  test('series episodes hand the provider address to the player', async () => {
    const query = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({
        id: 'channel-1',
        xtream_id: '77',
        name: 'Example Series',
        logo_url: null,
        stream_url: 'https://provider.example/series/u/p/5.mp4',
        stream_type: 'series',
        extras: {},
        created_at: new Date('2026-07-28T10:00:00Z'),
        category_xtream_id: '9',
      }),
    };
    mockDb.mockReturnValue(query);

    const response = await xtreamOutputService.getSeriesInfo('playlist-1', '77');

    expect(response.episodes['1'][0].direct_source).toBe('https://provider.example/series/u/p/5.mp4');
    expect(response.episodes['1'][0].direct_source).not.toContain('iptv.example.test');
  });

  // Kisa M3U baglantisi: uzun `get.php` adresi elle girilemeyecek kadar uzun.
  // Ayni yetkiyi tasidigi icin sir de sifre gibi karma olarak saklanmali ve
  // kimlik yenilendiginde eski kisa adres calismamali.
  test('enable returns a short m3u address and stores the secret hashed', async () => {
    const ownership = firstQuery({ id: 'playlist-1', user_id: 'user-1' });
    const update = {
      where: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{ id: 'playlist-1' }]),
    };
    mockDb.mockReturnValueOnce(ownership).mockReturnValueOnce(update);

    const result = await xtreamOutputService.enable('user-1', 'playlist-1');
    const written = update.update.mock.calls[0][0];
    const shortUrl = new URL(result.m3uShortUrl);

    expect(shortUrl.pathname).toBe('/m3u.php');
    expect(shortUrl.searchParams.get('id')).toBe(written.output_short_id);
    expect(shortUrl.searchParams.get('secret')).toHaveLength(16);
    // Adres, uzun bicimin yarisindan kisa olmali.
    expect(shortUrl.toString().length).toBeLessThan(result.m3uUrl.length / 1.5);
    // Sir asla duz metin olarak kolonda durmaz.
    expect(written.output_short_secret_hash).toBe(hashToken(shortUrl.searchParams.get('secret')));
    expect(written.output_short_secret_enc).not.toBe(shortUrl.searchParams.get('secret'));
  });

  test('short link authentication accepts the stored secret and refuses everything else', async () => {
    const stored = {
      id: 'playlist-1',
      output_enabled: true,
      output_short_id: 'AbCdEfGh',
      output_short_secret_hash: hashToken('dogru-sir'),
    };
    mockDb.mockReturnValue(firstQuery(stored));
    await expect(xtreamOutputService.authenticateShortLink('AbCdEfGh', 'dogru-sir'))
      .resolves.toEqual({ status: 'valid', playlist: stored });
    await expect(xtreamOutputService.authenticateShortLink('AbCdEfGh', 'yanlis-sir'))
      .resolves.toEqual({ status: 'invalid', playlist: null });

    mockDb.mockReturnValue(firstQuery({ ...stored, output_enabled: false }));
    await expect(xtreamOutputService.authenticateShortLink('AbCdEfGh', 'dogru-sir'))
      .resolves.toEqual({ status: 'disabled', playlist: null });

    // Bilinmeyen kimlikte sorgu bile calismaz; yanit yine 'invalid'.
    mockDb.mockReturnValue(firstQuery(undefined));
    await expect(xtreamOutputService.authenticateShortLink('yok', 'dogru-sir'))
      .resolves.toEqual({ status: 'invalid', playlist: null });
  });

  test('the stream mode switch no longer exists', () => {
    expect(xtreamOutputService.setStreamMode).toBeUndefined();
    expect(xtreamOutputService.getPlaybackTarget).toBeUndefined();
  });
});
