const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const db = require('./config/db');

// Rutas modulares de la API
const authRoutes = require('./routes/auth');
const pacientesRoutes = require('./routes/pacientes');
const demandaRoutes = require('./routes/demanda');
const agendaRoutes = require('./routes/agenda');
const campanasRoutes = require('./routes/campanas');

const app = express();

// ========================================================
// 🌐 CONFIGURACIÓN DE PROXY INVERSO (EASYPANEL / TRAEFIK)
// Permite que express-rate-limit lea correctamente la IP real
// desde 'X-Forwarded-For' sin lanzar ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
// ========================================================
app.set('trust proxy', 1);

// ========================================================
// 🛡️ MIDDLEWARES DE SEGURIDAD Y CONFIGURACIÓN
// ========================================================
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting global para prevenir abusos de API
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // Máximo 1000 peticiones por ventana
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: {
    success: false,
    error: 'Límite de solicitudes excedido. Intente nuevamente más tarde.',
  },
});
app.use('/api/', globalLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========================================================
// 🔍 ENDPOINT DE HEALTHCHECK PÚBLICO
// ========================================================
app.get('/health', async (req, res) => {
  const start = Date.now();
  try {
    await db.query('SELECT 1');
    const latency = Date.now() - start;
    res.status(200).json({
      status: 'ok',
      service: 'BFF Hospital PyM',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      database: 'connected',
      db_latency_ms: latency,
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      service: 'BFF Hospital PyM',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: err.message,
    });
  }
});

// ========================================================
// 📡 REGISTRO DE RUTAS /api/v1
// ========================================================
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/pacientes', pacientesRoutes);
app.use('/api/v1/demanda', demandaRoutes);
app.use('/api/v1/agenda', agendaRoutes);
app.use('/api/v1/campanas', campanasRoutes);

// Manejo de rutas inexistentes (404)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint no encontrado: ${req.method} ${req.originalUrl}`,
  });
});

// Manejador centralizado de errores (500)
app.use((err, req, res, next) => {
  console.error('[UNHANDLED SERVER ERROR]:', err);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Error interno del servidor' 
      : err.message,
  });
});

module.exports = app;
