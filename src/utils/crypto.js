const crypto = require('crypto');

const DEFAULT_ITERATIONS = 10000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

/**
 * Genera un hash seguro utilizando PBKDF2-HMAC-SHA256 con salt aleatorio.
 * Compatible con la clase Dart `PasswordSecurity` de Flutter.
 * Formato: `pbkdf2:sha256:<iteraciones>:<salt_hex>:<hash_hex>`
 */
function hashPassword(password, iterations = DEFAULT_ITERATIONS) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, KEY_BYTES, 'sha256');
  return `pbkdf2:sha256:${iterations}:${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

/**
 * Verifica una contraseña contra el hash almacenado con soporte multiesquema:
 * 1. PBKDF2-HMAC-SHA256 moderno.
 * 2. SHA-256 legado simple (64 caracteres hex).
 * 3. Fallback de texto plano (para cuentas en migración).
 */
function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;

  // 1. Esquema moderno PBKDF2
  if (storedHash.startsWith('pbkdf2:sha256:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 5) return false;
    const iterations = parseInt(parts[2], 10);
    const salt = Buffer.from(parts[3], 'hex');
    const expectedHash = Buffer.from(parts[4], 'hex');

    const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, expectedHash.length, 'sha256');
    return crypto.timingSafeEqual(derivedKey, expectedHash);
  }

  // 2. Esquema legado SHA-256 (64 hex)
  if (storedHash.length === 64 && /^[a-fA-F0-9]{64}$/.test(storedHash)) {
    const legacyDigest = crypto.createHash('sha256').update(password, 'utf8').digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(legacyDigest.toLowerCase()),
      Buffer.from(storedHash.toLowerCase())
    );
  }

  // 3. Fallback texto plano (migración)
  const a = Buffer.from(password);
  const b = Buffer.from(storedHash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Indica si la contraseña requiere ser re-hasheada al estándar PBKDF2.
 */
function needsRehash(storedHash, targetIterations = DEFAULT_ITERATIONS) {
  if (!storedHash || !storedHash.startsWith('pbkdf2:sha256:')) return true;
  const parts = storedHash.split(':');
  if (parts.length !== 5) return true;
  const iterations = parseInt(parts[2], 10);
  return iterations < targetIterations;
}

module.exports = {
  hashPassword,
  verifyPassword,
  needsRehash,
};

