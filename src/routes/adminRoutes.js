const express = require('express');
const {
  listarTodos, obtenerPorId, crear, actualizar, eliminar, restaurar,
  listarCategoriasTodas, estadisticas, listarAuditoria,
} = require('../controllers/adminProductoController');
const { login, me } = require('../controllers/authController');
const { requerirAdmin, rateLimit } = require('../middlewares/auth');
const { subirImagenes } = require('../services/imagenProducto');
const {
  subirImagenesProducto,
  eliminarImagenProducto,
  establecerImagenPrincipal,
} = require('../controllers/adminImagenProductoController');

const router = express.Router();

// Login con límite estricto anti fuerza bruta (configurable por entorno).
router.post('/auth/login', rateLimit({
  ventanaMs: 60000,
  max: Number(process.env.LOGIN_RATE_MAX || 8),
  mensaje: 'Demasiados intentos. Espera un minuto.',
}), login);

// Todo lo siguiente exige rol admin.
router.get('/auth/me', requerirAdmin, me);
router.get('/stats', requerirAdmin, estadisticas);
router.get('/categorias', requerirAdmin, listarCategoriasTodas);
router.get('/auditoria', requerirAdmin, listarAuditoria);
router.get('/productos', requerirAdmin, listarTodos);
router.get('/productos/:id', requerirAdmin, obtenerPorId);
router.post('/productos', requerirAdmin, crear);
router.put('/productos/:id', requerirAdmin, actualizar);
router.post('/productos/:id/restaurar', requerirAdmin, restaurar);
router.delete('/productos/:id', requerirAdmin, eliminar);
router.post('/productos/:id/imagenes', requerirAdmin, subirImagenes.array('imagenes', 12), subirImagenesProducto);
router.delete('/productos/:id/imagenes/:imagenId', requerirAdmin, eliminarImagenProducto);
router.patch('/productos/:id/imagenes/:imagenId/principal', requerirAdmin, establecerImagenPrincipal);

module.exports = router;
