const FilterRuleService = require('../services/FilterRuleService');

const filterRuleService = new FilterRuleService();

/**
 * GET /api/playlists/:id/filter-rules
 */
async function listRules(req, res, next) {
  try {
    res.json(await filterRuleService.list(req.userId, req.params.id));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/playlists/:id/filter-rules
 */
async function createRule(req, res, next) {
  try {
    const rule = await filterRuleService.create(req.userId, req.params.id, req.body);
    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/playlists/:id/filter-rules/test
 * Deseni mevcut kanal verisinde dener, ilk 5 eslesmeyi dondurur.
 */
async function testRule(req, res, next) {
  try {
    res.json(await filterRuleService.testPattern(req.userId, req.params.id, req.body || {}));
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/filter-rules/:id
 */
async function updateRule(req, res, next) {
  try {
    res.json(await filterRuleService.update(req.userId, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/filter-rules/:id
 */
async function deleteRule(req, res, next) {
  try {
    await filterRuleService.remove(req.userId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/filter-rules/:id/order  { direction: 'up' | 'down' }
 */
async function moveRule(req, res, next) {
  try {
    res.json(await filterRuleService.move(req.userId, req.params.id, req.body?.direction));
  } catch (err) {
    next(err);
  }
}

module.exports = { listRules, createRule, testRule, updateRule, deleteRule, moveRule };
