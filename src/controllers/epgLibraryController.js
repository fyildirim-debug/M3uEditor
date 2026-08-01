const EpgLibraryService = require('../services/EpgLibraryService');

const epgLibraryService = new EpgLibraryService();

async function listCountries(req, res, next) {
  try {
    res.json(await epgLibraryService.listCountries());
  } catch (error) {
    next(error);
  }
}

async function listGuides(req, res, next) {
  try {
    const { country, language, q } = req.query;
    res.json(await epgLibraryService.listGuides({ country, language, q }));
  } catch (error) {
    next(error);
  }
}

module.exports = { listCountries, listGuides };
