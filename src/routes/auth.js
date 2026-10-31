const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const { verifyPassword, hashPassword, needsRehash } = require('../utils/crypto');
const { authenticateToken, requireRole, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Rate limiter específico para prevenir ataques de fuerza bruta en login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // Máximo 20 intentos por IP
  message: {
    success: false,
    error: 'Demasiados intentos de inicio de sesión. Por seguridad intente en 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/v1/auth/login
 * Autentica usuario y emite JWT seguro
 */
router.post('/login', loginLimiter, async (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({
      success: false,
      error: 'Debe ingresar usuario y contraseña',
    });
  }

  try {
    const result = await db.query(
      `SELECT "id_usuario_app", "nombre_completo", "rol", "password", "activo"
       FROM "USUARIOS_APP"
       WHERE "usuario" = $1 AND "activo" = true
       LIMIT 1`,
      [usuario.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas o usuario inactivo',
      });
    }

    const row = result.rows[0];
    const storedHash = row.password || '';

    const isValid = verifyPassword(password, storedHash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas',
      });
    }

    // Actualización transparente (Transparent Rehash) a PBKDF2 si es legado
    if (needsRehash(storedHash)) {
      const modernHash = hashPassword(password);
      db.query(
        `UPDATE "USUARIOS_APP" SET "password" = $1 WHERE "id_usuario_app" = $2`,
        [modernHash, row.id_usuario_app]
      ).catch((err) => console.error('[AUTH REHASH ERROR]:', err));
    }

    // Registro de auditoría
    db.query(
      `INSERT INTO public."AUDITORIA_SISTEMA" ("usuario_app", "modulo", "accion_realizada")
       VALUES ($1, 'Autenticación BFF', 'Inicio de sesión exitoso')`,
      [row.nombre_completo]
    ).catch(() => {});

    // Generar token JWT firmado
    const token = jwt.sign(
      {
        id: row.id_usuario_app,
        nombre: row.nombre_completo,
        rol: row.rol,
        usuario: usuario.trim(),
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: row.id_usuario_app,
        nombre: row.nombre_completo,
        rol: row.rol,
        usuario: usuario.trim(),
      },
    });
  } catch (err) {
    console.error('[LOGIN ERROR]:', err);
    res.status(500).json({
      success: false,
      error: 'Error interno en el servidor de autenticación',
    });
  }
});

/**
 * GET /api/v1/auth/me
 * Retorna datos del usuario autenticado
 */
router.get('/me', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

/**
 * GET /api/v1/auth/usuarios
 * Listado administrativo de usuarios (requiere rol Admin)
 */
router.get('/usuarios', authenticateToken, requireRole(['Admin']), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT "id_usuario_app" AS id, "documento", "nombre_completo" AS nombre, "usuario", "rol", "activo"
       FROM "USUARIOS_APP"
       ORDER BY "id_usuario_app" ASC`
    );
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error('[FETCH USUARIOS ERROR]:', err);
    res.status(500).json({ success: false, error: 'Error al consultar usuarios' });
  }
});

module.exports = router;

