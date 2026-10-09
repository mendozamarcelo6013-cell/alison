const fs = require('fs');
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

function esRutaPanel(ruta) {
  return ruta.endsWith('admin.html')
    || ruta === '/admin'
    || ruta.startsWith('/admin/')
    || ruta === '/horus-admin'
    || ruta.startsWith('/horus-admin/');
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
  if (esRutaPanel(req.path)) {
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

// /horus-admin es la pantalla de login + panel: el HTML es público como wp-login.php,
// pero ningún dato ni mutación responde sin token de rol admin.
function cabecerasPanel(res, rutaOArchivo) {
  if (esRutaPanel(rutaOArchivo)) {
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
  }
}

// 1) Frontend React compilado (frontend/dist) cuando existe. Al ir antes que
//    public/, los HTML/estáticos nuevos son los que responde el servidor.
// 2) public/ queda como respaldo: permite deshacer la migración sin tocar el
//    backend y sigue aportando /assets y /uploads ya publicados.
const directorioFrontend = path.join(__dirname, '../frontend/dist');
const raizSpa = path.join(directorioFrontend, 'index.html');
const buildFrontendDisponible = fs.existsSync(raizSpa);

// Extensiones que siempre son recurso estático: nunca deben devolver el shell SPA.
const EXTENSIONES_RECURSO = new Set([
  '.js', '.mjs', '.cjs', '.map', '.css', '.png', '.jpg', '.jpeg', '.webp', '.avif',
  '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.txt', '.xml', '.pdf',
  '.zip', '.json',
]);

if (buildFrontendDisponible) {
  // URLs antiguas del MPA -> rutas SPA equivalentes. Se resuelven en el servidor
  // para que /market.html no sirva el HTML legado que sigue en public/.
  app.get(
    ['/market.html', '/market-carrito.html', '/market-checkout.html', '/admin.html'],
    (req, res) => {
      const destinos = {
        '/market.html': '/market',
        '/market-carrito.html': '/market/carrito',
        '/market-checkout.html': '/market/checkout',
        '/admin.html': '/horus-admin',
      };
      return res.redirect(302, destinos[req.path]);
    },
  );
  app.get(['/admin', '/admin/'], (req, res) => res.redirect(302, '/horus-admin'));
  app.get('/market-producto.html', (req, res) => {
    const slug = typeof req.query.slug === 'string' ? req.query.slug.trim() : '';
    return res.redirect(302, slug ? `/market/producto/${encodeURIComponent(slug)}` : '/market');
  });

  app.use(express.static(directorioFrontend, { setHeaders: cabecerasPanel }));
}
app.use(express.static(path.join(__dirname, '../public'), { setHeaders: cabecerasPanel }));

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

// Fallback SPA: toda ruta de navegación responde index.html (recarga directa de
// /market/producto/:slug, /horus-admin, etc.). Nunca intercepta la API, /uploads ni los
// recursos estáticos, que siguen respondiendo JSON 404 o su propio archivo.
app.use((req, res) => {
  const esDescarga = req.method === 'GET' || req.method === 'HEAD';
  const esApi = req.path === '/api' || req.path.startsWith('/api/');
  const esSubida = req.path === '/uploads' || req.path.startsWith('/uploads/');
  const esRecurso = EXTENSIONES_RECURSO.has(path.extname(req.path).toLowerCase());

  if (esDescarga && buildFrontendDisponible && !esApi && !esSubida && !esRecurso) {
    cabecerasPanel(res, req.path);
    if (!esRutaPanel(req.path)) {
      // El shell referencia assets con hash: hay que revalidar en cada visita.
      res.set('Cache-Control', 'no-cache');
    }
    return res.sendFile(raizSpa);
  }

  return res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada' });
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
