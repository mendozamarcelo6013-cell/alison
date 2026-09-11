const express = require('express');
const { crearPedido } = require('../controllers/pedidoController');

const router = express.Router();

router.post('/', crearPedido);

module.exports = router;
