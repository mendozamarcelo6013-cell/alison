const path = require('path');
const express = require('express');
const multer = require('multer');
const categoriaRoutes = require('./routes/categoriaRoutes');
const productoRoutes = require('./routes/productoRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');
const pagoRoutes = require('./routes/pagoRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { rateLimit } = require('./middlewares/auth');
const { directorioRaiz } = require('./services/imagenProducto');

const app = express();

// Confiar en X-Forwarded-For SOLO tras el proxy real. Por defecto no se confía
// (0): req.ip es la conexión directa y el rate-limit/auditoría no dependen de
// cabeceras que el cliente puede falsificar. En Render (tras su proxy) usar
// TRUST_PROXY=1. Acepta número de saltos, IP o subred (sintaxis de Express).
function parseTrustProxy(valor) {
  if (valor === undefined || valor === '') return 0;
  if (/^\d+$/.test(valor)) return Number(valor);
  if (valor === 'true') return true;
  if (valor === 'false') return false;
  return valor;
}
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));
app.disable('x-powered-by');

// Cabeceras de seguridad (equivalente helmet mínimo, sin dependencias nuevas).
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  });
  if (process.env.NODE_ENV === 'production') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  // CSP: la tienda usa Google Fonts; el panel no necesita scripts externos.
  if (req.path.startsWith('/admin')) {
    res.set('Content-Security-Policy', "default-src 'self'; img-src 'self' https: data: blob:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'");
  }
  return next();
});

// Límite de cuerpo para mitigar abuso en JSON.
app.use(express.json({ limit: '100kb' }));

// Las imágenes viven fuera del árbol del código y se montan con una ruta estable.
app.use('/uploads/productos', express.static(directorioRaiz, { fallthrough: true }));

// Rate-limit general del área admin (el login tiene uno más estricto en su ruta).
// En memoria por instancia; con varias réplicas, limitar en el proxy (ver README).
app.use('/api/admin', rateLimit({
  ventanaMs: 60000,
  max: Number(process.env.ADMIN_RATE_MAX || 180),
}));

// admin.html es la pantalla de login + panel: el HTML es público como wp-login.php,
// pero ningún dato ni mutación responde sin token de rol admin.
app.use(express.static(path.join(__dirname, '../public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('admin.html')) {
      res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
    }
  },
}));

app.get('/health', async (req, res) => {
  try {
    const sequelize = require('./config/database');
    await sequelize.authenticate();
    return res.json({ ok: true, mensaje: 'Horus Market API saludable' });
  } catch (error) {
    console.error('Health check sin conexión a MySQL:', error.message);
    return res.status(503).json({ ok: false, mensaje: 'Base de datos no disponible' });
  }
});

app.get('/api', (req, res) => {
  res.json({ ok: true, mensaje: 'Horus Market API' });
});

app.use('/api/categorias', categoriaRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/pagos', pagoRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada' });
});

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  console.error('Error no controlado en la API:', error);
  if (error instanceof multer.MulterError) {
    const mensaje = error.code === 'LIMIT_FILE_SIZE'
      ? `Cada imagen debe pesar como máximo ${process.env.PRODUCT_IMAGE_MAX_MB || 5} MB.`
      : error.message || 'No se pudo procesar la imagen.';
    return res.status(400).json({ ok: false, mensaje });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, mensaje: 'Cuerpo demasiado grande.' });
  }
  return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
});

module.exports = app;
