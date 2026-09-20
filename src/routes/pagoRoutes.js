const express = require('express');
const {
  obtenerConfiguracionPago,
  iniciarCheckoutPago,
} = require('../controllers/pagoController');

const router = express.Router();

router.get('/configuracion', obtenerConfiguracionPago);
router.post('/checkout', iniciarCheckoutPago);

module.exports = router;
