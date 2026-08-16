const logoLibraryService = require('../services/LogoLibraryService');

/**
 * Hazir logo kutuphanesi (tv-logo/tv-logos) uclari.
 *
 * Dizin sunucuda 24 saat onbelleklenir; buradaki cagrilarin her biri disari
 * istek atmaz, bellekteki indeks uzerinde calisir.
 */

async function search(req, res, next) {
  try {
    res.json(await logoLibraryService.search({
      q: req.query.q,
      group: req.query.group,
      preferGroup: req.query.preferGroup,
      limit: req.query.limit,
      offset: req.query.offset,
    }));
  } catch (error) { next(error); }
}

async function listGroups(_req, res, next) {
  try {
    res.json(await logoLibraryService.listGroups());
  } catch (error) { next(error); }
}

module.exports = { search, listGroups };
