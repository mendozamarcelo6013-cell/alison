const crypto = require('crypto');

// Formato propio: scrypt$N$r$p$saltHex$hashHex
// Evita añadir dependencias nativas en Render; scrypt es suficiente para un panel interno.
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 10) {
    throw new Error('La contraseña debe tener al menos 10 caracteres.');
  }
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;
  const partes = stored.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, n, r, p, saltHex, hashHex] = partes;
  try {
    const hash = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), KEYLEN, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    const esperado = Buffer.from(hashHex, 'hex');
    if (hash.length !== esperado.length) return false;
    return crypto.timingSafeEqual(hash, esperado);
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
