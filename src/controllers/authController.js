const { Usuario } = require('../models');
const { verifyPassword } = require('../utils/password');
const { firmarToken } = require('../utils/token');

// POST /api/admin/auth/login { email, password }
exports.login = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return res.status(400).json({ ok: false, mensaje: 'Email y contraseña son obligatorios.' });
    }
    const usuario = await Usuario.findOne({ where: { email } });
    // Respuesta genérica para no revelar si el email existe.
    const invalido = () => res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas.' });
    if (!usuario || !usuario.activo) return invalido();
    if (!verifyPassword(password, usuario.password_hash)) return invalido();
    if (usuario.rol !== 'admin') {
      return res.status(403).json({ ok: false, mensaje: 'Esta cuenta no tiene rol de administración.' });
    }
    const token = firmarToken({ sub: usuario.id, email: usuario.email, rol: usuario.rol });
    return res.json({
      ok: true,
      mensaje: 'Sesión iniciada.',
      token,
      usuario: { id: usuario.id, email: usuario.email, nombres: usuario.nombres, rol: usuario.rol },
    });
  } catch (error) {
    console.error('Error en login admin:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo iniciar sesión.' });
  }
};

// GET /api/admin/auth/me (requiere admin)
exports.me = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.usuario.id, {
      attributes: ['id', 'email', 'nombres', 'apellidos', 'rol', 'activo'],
    });
    if (!usuario || !usuario.activo || usuario.rol !== 'admin') {
      return res.status(403).json({ ok: false, mensaje: 'Sesión sin privilegios de administración.' });
    }
    return res.json({ ok: true, usuario });
  } catch (error) {
    console.error('Error en /me admin:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo verificar la sesión.' });
  }
};
