const { Pedido } = require('../models');
const {
  PasarelaPagoError,
  obtenerEstadoPasarela,
  crearCheckoutPago,
} = require('../services/paymentGateway');

exports.obtenerConfiguracionPago = (req, res) => {
  res.json({ ok: true, ...obtenerEstadoPasarela() });
};

exports.iniciarCheckoutPago = async (req, res) => {
  const numeroPedido = typeof req.body?.numero_pedido === 'string'
    ? req.body.numero_pedido.trim()
    : '';

  if (!numeroPedido) {
    return res.status(400).json({ ok: false, mensaje: 'El número de pedido es obligatorio.' });
  }

  try {
    const pedido = await Pedido.findOne({ where: { numero_pedido: numeroPedido } });
    if (!pedido) {
      return res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado.' });
    }

    const checkout = await crearCheckoutPago({ pedido });
    return res.json({ ok: true, checkout_url: checkout.checkout_url });
  } catch (error) {
    if (error instanceof PasarelaPagoError) {
      return res.status(503).json({ ok: false, codigo: error.codigo, mensaje: error.message });
    }

    console.error('Error al iniciar checkout de pago:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo iniciar el pago en línea.' });
  }
};
