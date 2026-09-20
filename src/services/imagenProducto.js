const fs = require('fs');
const path = require('path');
const multer = require('multer');

const directorioRaiz = path.resolve(process.env.PRODUCT_UPLOADS_DIR || path.join(process.cwd(), 'uploads/productos'));
const maximoMb = Number(process.env.PRODUCT_IMAGE_MAX_MB || 5);
const maximoBytes = maximoMb * 1024 * 1024;
const extensionesPermitidas = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const tiposPermitidos = new Set(['image/jpeg', 'image/png', 'image/webp']);

function destinoProducto(req) {
  const destino = path.join(directorioRaiz, String(req.params.id));
  fs.mkdirSync(destino, { recursive: true });
  return destino;
}

const almacenamientoLocal = multer.diskStorage({
  destination: (req, file, callback) => callback(null, destinoProducto(req)),
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const nombre = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${extension}`;
    callback(null, nombre);
  },
});

const filtroImagen = (req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!extensionesPermitidas.has(extension) || !tiposPermitidos.has(file.mimetype)) {
    return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Solo se permiten imágenes JPG, JPEG, PNG o WEBP.'));
  }
  return callback(null, true);
};

const subirImagenes = multer({
  storage: almacenamientoLocal,
  fileFilter: filtroImagen,
  limits: { fileSize: maximoBytes, files: 12 },
});

function urlPublicaProducto(id, nombreArchivo) {
  return `/uploads/productos/${encodeURIComponent(id)}/${encodeURIComponent(nombreArchivo)}`;
}

function construirUrlPublica(req, ruta) {
  if (!ruta || /^https?:\/\//i.test(ruta)) return ruta;
  const base = (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  return `${base}${ruta.startsWith('/') ? ruta : `/${ruta}`}`;
}

function eliminarArchivoLocal(url) {
  if (!url || !url.startsWith('/uploads/productos/')) return;
  const relativo = decodeURIComponent(url.replace(/^\/uploads\/productos\//, ''));
  const archivo = path.resolve(directorioRaiz, relativo);
  if (!archivo.startsWith(`${directorioRaiz}${path.sep}`)) return;
  fs.rmSync(archivo, { force: true });
}

module.exports = {
  directorioRaiz,
  maximoMb,
  subirImagenes,
  urlPublicaProducto,
  construirUrlPublica,
  eliminarArchivoLocal,
};