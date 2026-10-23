const express = require('express');
const { crearPedido, consultarEstadoPedido } = require('../controllers/pedidoController');

const router = express.Router();

router.post('/', crearPedido);
router.get('/:numero_pedido', consultarEstadoPedido);

module.exports = router;
