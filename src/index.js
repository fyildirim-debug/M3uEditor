require('dotenv').config();
const logger = require('./config/logger');
const db = require('./config/database');
const app = require('./app');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'M3U Playlist Editor API started');
});

// Graceful shutdown
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutdown signal received');
  const forcedExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out');
    process.exit(1);
  }, 10000);
  forcedExit.unref();

  server.close(async () => {
    try {
      await db.destroy();
      clearTimeout(forcedExit);
      logger.info('Server and database pool closed');
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'Database pool could not be closed');
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (error) => {
  logger.fatal({ err: error }, 'Unhandled promise rejection');
  shutdown('unhandledRejection');
});
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  shutdown('uncaughtException');
});

module.exports = { logger };
