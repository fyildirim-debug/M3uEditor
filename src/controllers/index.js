// Controllers - request/response handling
const channelController = require('./channelController');
const categoryController = require('./categoryController');
const importController = require('./importController');
const epgController = require('./epgController');
const exportController = require('./exportController');
const playlistController = require('./playlistController');

module.exports = {
  channelController,
  categoryController,
  importController,
  epgController,
  exportController,
  playlistController,
};
