import http from 'node:http';
import { app } from './app.js';
import { initSocketServer } from './socket/index.js';
import { env } from './config/env.js';

const server = http.createServer(app);
const io = initSocketServer(server);

server.listen(env.PORT, () => {
  console.log(`
🚀 [Zoopie Server] Running at http://localhost:${env.PORT}
📡 [Socket.IO] Ready for connections
🌐 [CORS] Allowed origin: ${env.CLIENT_ORIGIN}
🏥 [Health] Check http://localhost:${env.PORT}/health
  `);
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n[Zoopie Server] Shutting down gracefully...');
  io.close(() => {
    server.close(() => {
      console.log('[Zoopie Server] Server closed.');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { server, io };
