const path = require('path');
const express = require('express');
const categoriaRoutes = require('./routes/categoriaRoutes');
const productoRoutes = require('./routes/productoRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');
const pagoRoutes = require('./routes/pagoRoutes');

const app = express();

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

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

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    mensaje: 'Ruta no encontrada',
  });
});

app.use((error, req, res, next) => {
  console.error('Error no controlado en la API:', error);
  res.status(500).json({
    ok: false,
    mensaje: 'Error interno del servidor',
  });
});

module.exports = app;
