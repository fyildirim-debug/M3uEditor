const xtreamOutputService = require('../services/XtreamOutputService');

function credentialPart(value) {
  return typeof value === 'string' ? value : '';
}

async function authenticatePlayer(req, res, authZeroOnInvalid = false) {
  const username = credentialPart(req.query.username || req.params.username);
  const password = credentialPart(req.query.password || req.params.password);
  const result = await xtreamOutputService.authenticate(username, password);

  if (result.status === 'valid') return { playlist: result.playlist, username, password };

  res.locals.xtreamAuthFailed = true;
  if (result.status === 'disabled') {
    res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Xtream çıkışı etkin değil' } });
  } else if (authZeroOnInvalid) {
    res.status(200).json({ user_info: { auth: 0 } });
  } else {
    res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Hatalı Xtream kimlik bilgileri' } });
  }
  return null;
}

async function enable(req, res, next) {
  try {
    res.status(201).json(await xtreamOutputService.enable(req.userId, req.params.id));
  } catch (error) { next(error); }
}

async function getConfiguration(req, res, next) {
  try {
    res.json(await xtreamOutputService.getConfiguration(req.userId, req.params.id));
  } catch (error) { next(error); }
}

async function regenerate(req, res, next) {
  try {
    res.json(await xtreamOutputService.regenerate(req.userId, req.params.id));
  } catch (error) { next(error); }
}

async function disable(req, res, next) {
  try {
    res.json(await xtreamOutputService.disable(req.userId, req.params.id));
  } catch (error) { next(error); }
}

async function playerApi(req, res, next) {
  try {
    const auth = await authenticatePlayer(req, res, true);
    if (!auth) return;

    const { playlist, username, password } = auth;
    switch (req.query.action) {
      case undefined:
      case '':
        return res.json(xtreamOutputService.accountResponse(playlist, username, password));
      case 'get_live_categories':
        return res.json(await xtreamOutputService.getCategories(playlist.id, 'live'));
      case 'get_vod_categories':
        return res.json(await xtreamOutputService.getCategories(playlist.id, 'vod'));
      case 'get_series_categories':
        return res.json(await xtreamOutputService.getCategories(playlist.id, 'series'));
      case 'get_live_streams':
        return res.json(await xtreamOutputService.getLiveStreams(playlist.id, req.query.category_id));
      case 'get_vod_streams':
        return res.json(await xtreamOutputService.getVodStreams(playlist.id, req.query.category_id));
      case 'get_series':
        return res.json(await xtreamOutputService.getSeries(playlist.id, req.query.category_id));
      case 'get_vod_info':
        return res.json(await xtreamOutputService.getVodInfo(playlist.id, req.query.vod_id));
      case 'get_series_info':
        return res.json(await xtreamOutputService.getSeriesInfo(playlist.id, req.query.series_id));
      case 'get_short_epg':
        return res.json(await xtreamOutputService.getEpg(playlist, req.query.stream_id, req.query.limit, true));
      case 'get_simple_data_table':
        return res.json(await xtreamOutputService.getEpg(playlist, req.query.stream_id, null, false));
      default:
        return res.json([]);
    }
  } catch (error) { next(error); }
}

function pipeXml(stream, res, next) {
  stream.once('error', (error) => {
    if (!res.headersSent) next(error);
    else res.destroy(error);
  });
  res.once('close', () => {
    if (!res.writableFinished) stream.destroy();
  });
  stream.pipe(res);
}

async function xmltv(req, res, next) {
  try {
    const auth = await authenticatePlayer(req, res);
    if (!auth) return;
    const stream = await xtreamOutputService.createXmltvStream(auth.playlist, req.query.days);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    pipeXml(stream, res, next);
  } catch (error) { next(error); }
}

async function m3u(req, res, next) {
  try {
    const auth = await authenticatePlayer(req, res);
    if (!auth) return;
    const output = req.query.output === 'm3u8' ? 'm3u8' : 'ts';
    const content = await xtreamOutputService.createM3U(
      auth.playlist,
      auth.username,
      auth.password,
      output
    );
    res.setHeader('Content-Type', 'audio/x-mpegurl');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(content);
  } catch (error) { next(error); }
}

function playback(streamType) {
  return async (req, res, next) => {
    try {
      const auth = await authenticatePlayer(req, res);
      if (!auth) return;
      const target = await xtreamOutputService.getPlaybackTarget(auth.playlist.id, streamType, req.params.streamId);
      res.redirect(302, target);
    } catch (error) { next(error); }
  };
}

module.exports = {
  enable,
  getConfiguration,
  regenerate,
  disable,
  playerApi,
  xmltv,
  m3u,
  playLive: playback('live'),
  playMovie: playback('vod'),
  playSeries: playback('series'),
};
