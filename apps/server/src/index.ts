import http from 'node:http';
import { app } from './app.js';
import { initSocketServer } from './socket/index.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { prisma } from './db/client.js';
import { setShuttingDown } from './routes/health.js';

const server = http.createServer(app);
const io = initSocketServer(server);

server.listen(env.PORT, () => {
  logger.info('Zoopie Server initialized and ready', {
    port: env.PORT,
    environment: env.NODE_ENV,
    corsOrigin: env.CLIENT_ORIGIN,
    healthEndpoint: `/health`,
    readinessEndpoint: `/ready`,
    turnConfigured: Boolean(env.TURN_SERVER_URL),
  });

  if (env.NODE_ENV === 'production' && !env.TURN_SERVER_URL) {
    logger.warn(
      'DEPLOYMENT WARNING: TURN_SERVER_URL is unset in production. Direct WebRTC peer connections will fail behind symmetric NATs and restrictive firewalls.'
    );
  }
});

let isShuttingDown = false;

// Graceful shutdown procedure
export async function gracefulShutdown(signal?: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  setShuttingDown(true);

  logger.info('Commencing graceful shutdown', { signal });

  // Force termination watchdog if graceful drainage exceeds 10 seconds
  const forceExitTimer = setTimeout(() => {
    logger.warn('Graceful shutdown timeout exceeded (10s). Forcing process exit.');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  try {
    // 1. Stop accepting new socket connections and disconnect active sockets
    await new Promise<void>(resolve => {
      io.close(() => {
        logger.info('Socket.IO engine closed cleanly');
        resolve();
      });
    });

    // 2. Stop accepting new HTTP requests and finish in-flight requests
    await new Promise<void>(resolve => {
      server.close(() => {
        logger.info('HTTP server closed cleanly');
        resolve();
      });
    });

    // 3. Disconnect database client
    await prisma.$disconnect().catch(() => {});
    logger.info('Database connections closed cleanly');

    logger.info('Graceful shutdown completed successfully');
    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (err) {
    logger.error('Error encountered during graceful shutdown', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { server, io };
