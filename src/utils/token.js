const crypto = require('crypto');

const DEV_FALLBACK = 'solo-desarrollo-no-usar-en-produccion';

function secreto() {
  const valor = process.env.ADMIN_SESSION_SECRET || process.env.JWT_SECRET;
  if (!valor) {
    if (process.env.NODE_ENV === 'production') {
      // Nunca operar en producción con un secreto predecible: sin secreto no hay tokens válidos.
      throw new Error('Falta ADMIN_SESSION_SECRET en producción. El servidor no puede iniciar sin él.');
    }
    if (!secreto._advertido) {
      secreto._advertido = true;
      console.warn('[admin] ADMIN_SESSION_SECRET no definido: usando secreto temporal solo para desarrollo.');
    }
    return DEV_FALLBACK;
  }
  if (valor.length < 32 && process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_SESSION_SECRET debe tener al menos 32 caracteres en producción.');
  }
  return valor;
}

// Validación temprana para server.js: falla al arrancar, no en la primera petición.
function exigirSecretoArranque() {
  secreto();
}

function base64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function firmarToken({ sub, email, rol }, ttlSegundos = 12 * 3600) {
  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const payload = base64url({
    sub,
    email,
    rol,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttlSegundos,
  });
  const firma = crypto.createHmac('sha256', secreto()).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${firma}`;
}

function verificarToken(token) {
  if (!token || typeof token !== 'string') return null;
  let clave;
  try {
    clave = secreto();
  } catch {
    return null;
  }
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [header, payload, firma] = partes;
  const esperada = crypto.createHmac('sha256', clave).update(`${header}.${payload}`).digest('base64url');
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const datos = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!datos.exp || datos.exp < Math.floor(Date.now() / 1000)) return null;
    return datos;
  } catch {
    return null;
  }
}

module.exports = { firmarToken, verificarToken, exigirSecretoArranque };
