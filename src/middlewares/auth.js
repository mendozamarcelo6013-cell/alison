const { verificarToken } = require('../utils/token');
const { Usuario } = require('../models');

// Solo Bearer en cabecera Authorization. No se aceptan cookies de sesión:
// al no existir credenciales automáticas del navegador, no hay superficie CSRF.
// Si algún día se añade cookie httpOnly, será obligatorio sumar token CSRF
// + Secure/HttpOnly/SameSite antes de aceptarla aquí.
function extraerToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}

function requerirAuth(req, res, next) {
  const datos = verificarToken(extraerToken(req));
  if (!datos) {
    return res.status(401).json({ ok: false, mensaje: 'No autenticado. Inicia sesión como administrador.' });
  }
  req.usuario = { id: datos.sub, email: datos.email, rol: datos.rol };
  return next();
}

function requerirAdmin(req, res, next) {
  const datos = verificarToken(extraerToken(req));
  if (!datos) {
    return res.status(401).json({ ok: false, mensaje: 'No autenticado. Inicia sesión como administrador.' });
  }
  if (datos.rol !== 'admin') {
    return res.status(403).json({ ok: false, mensaje: 'Acceso denegado: se requiere rol admin.' });
  }
  // Verificar en BD: cierra el hueco de tokens de usuarios eliminados/desactivados
  // y garantiza que creado_por_usuario_id siempre apunte a una fila válida.
  return Usuario.findByPk(datos.sub, { attributes: ['id', 'email', 'rol', 'activo'] })
    .then((usuario) => {
      if (!usuario || !usuario.activo || usuario.rol !== 'admin') {
        return res.status(403).json({ ok: false, mensaje: 'Sesión sin privilegios de administración.' });
      }
      req.usuario = { id: usuario.id, email: usuario.email, rol: usuario.rol };
      return next();
    })
    .catch((error) => {
      console.error('Error al verificar admin:', error.message);
      return res.status(500).json({ ok: false, mensaje: 'No se pudo verificar la sesión.' });
    });
}

// Rate-limit en memoria por instancia. Válido para despliegue de una réplica.
// Con varias réplicas, el límite debe aplicarse en el proxy/reverse-proxy o en
// un almacén compartido (Redis); ver README "Despliegue multirréplica".
// Límites configurables: LOGIN_RATE_MAX y ADMIN_RATE_MAX.
function rateLimit({ ventanaMs = 60000, max = 60, mensaje = 'Demasiadas solicitudes. Intenta de nuevo.' } = {}) {
  const intentos = new Map();
  const fronterizo = setInterval(() => {
    const ahora = Date.now();
    for (const [ip, lista] of intentos) {
      const vigentes = lista.filter((t) => ahora - t < ventanaMs);
      if (vigentes.length) intentos.set(ip, vigentes);
      else intentos.delete(ip);
    }
  }, ventanaMs);
  if (typeof fronterizo.unref === 'function') fronterizo.unref();
  return (req, res, next) => {
    // req.ip ya respeta 'trust proxy': solo depende de X-Forwarded-For cuando
    // el operador lo activó (TRUST_PROXY) para su proxy real.
    const ip = req.ip || 'desconocida';
    const ahora = Date.now();
    const lista = (intentos.get(ip) || []).filter((t) => ahora - t < ventanaMs);
    lista.push(ahora);
    intentos.set(ip, lista);
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(Math.max(0, max - lista.length)));
    if (lista.length > max) {
      res.set('Retry-After', String(Math.ceil(ventanaMs / 1000)));
      return res.status(429).json({ ok: false, mensaje });
    }
    return next();
  };
}

module.exports = { requerirAuth, requerirAdmin, rateLimit };
