require('dotenv').config();
const logger = require('./config/logger');
const { startServer } = require('./server');

let running = null;
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

  try {
    if (running) await running.close();
    clearTimeout(forcedExit);
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'Shutdown failed');
    process.exit(1);
  }
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

startServer()
  .then((instance) => { running = instance; })
  .catch((error) => {
    logger.fatal({ err: error }, 'Server could not start');
    process.exit(1);
  });

module.exports = { logger };
