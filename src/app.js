const path = require('path');
const express = require('express');
const categoriaRoutes = require('./routes/categoriaRoutes');
const productoRoutes = require('./routes/productoRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api', (req, res) => {
  res.json({ ok: true, mensaje: 'Horus Market API' });
});

app.use('/api/categorias', categoriaRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/pedidos', pedidoRoutes);

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
