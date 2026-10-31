const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'hospital_perpetuo_socorro_secret_key_default_development_2026';

/**
 * Middleware para validar el Bearer JWT en solicitudes protegidas.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Acceso no autorizado: Token de autenticación ausente',
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      const isExpired = err.name === 'TokenExpiredError';
      return res.status(403).json({
        success: false,
        error: isExpired ? 'Sesión expirada. Por favor inicie sesión nuevamente' : 'Token inválido o manipulado',
        code: isExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
      });
    }

    req.user = decoded;
    next();
  });
}

/**
 * Middleware para autorizar según roles asistenciales/administrativos.
 * @param {string[]} allowedRoles - Lista de roles permitidos (ej. ['Admin'])
 */
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'No autenticado' });
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({
        success: false,
        error: `Acceso denegado: El rol '${req.user.rol}' no tiene permisos para este recurso`,
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  JWT_SECRET,
};

