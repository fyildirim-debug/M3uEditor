const planService = require('../services/PlanService');

function checkPlaylistLimit() {
  return async (req, _res, next) => {
    try {
      await planService.checkPlaylistLimit(req.userId);
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { checkPlaylistLimit };
