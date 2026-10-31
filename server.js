require('dotenv').config();
const app = require('./src/app');
const db = require('./src/config/db');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🏥 BFF Hospital PyM iniciado exitosamente`);
  console.log(`🚀 Puerto: ${PORT} | Entorno: ${process.env.NODE_ENV || 'production'}`);
  console.log(`🔍 Healthcheck: http://localhost:${PORT}/health`);
  console.log(`=======================================================`);
});

// Apagado elegante (Graceful Shutdown)
const shutdown = async (signal) => {
  console.log(`\n[SHUTDOWN] Señal ${signal} recibida. Cerrando servidor ordenadamente...`);
  server.close(async () => {
    try {
      await db.pool.end();
      console.log('[SHUTDOWN] Pool de conexiones PostgreSQL liberado con éxito.');
      process.exit(0);
    } catch (err) {
      console.error('[SHUTDOWN ERROR] Fallo al cerrar el pool de PostgreSQL:', err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

