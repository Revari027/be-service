/**
 * HTTP server entry point (SDD section 18 step 2).
 *
 * Owns the listen socket and the graceful shutdown sequence: stop accepting new
 * connections, close the database pool, then exit.
 */
const http = require('http');
const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/database');

const SHUTDOWN_TIMEOUT_MS = 10000;

const server = http.createServer(app);

let shuttingDown = false;

server.listen(env.port, () => {
  console.log(`[server] inventory-backend listening on port ${env.port} (${env.nodeEnv})`);
});

async function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[server] shutting down (${reason})`);

  const forceExit = setTimeout(() => {
    console.error('[server] graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  forceExit.unref();

  server.close(async (error) => {
    if (error) {
      console.error('[server] error while closing the HTTP server', error);
    }

    try {
      await prisma.$disconnect();
      console.log('[server] database connection closed');
    } catch (disconnectError) {
      console.error('[server] failed to disconnect Prisma', disconnectError);
    }

    clearTimeout(forceExit);
    process.exit(error ? 1 : 0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled promise rejection', reason);
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  console.error('[server] uncaught exception', error);
  shutdown('uncaughtException');
});

module.exports = server;
