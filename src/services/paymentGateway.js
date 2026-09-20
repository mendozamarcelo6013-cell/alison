class PasarelaPagoError extends Error {
  constructor(mensaje, codigo = 'PASARELA_NO_CONFIGURADA') {
    super(mensaje);
    this.codigo = codigo;
  }
}

function proveedorConfigurado() {
  return (process.env.PAYMENT_PROVIDER || '').trim().toLowerCase();
}

function obtenerEstadoPasarela() {
  const proveedor = proveedorConfigurado();
  return {
    habilitada: false,
    proveedor: proveedor || null,
  };
}

async function crearCheckoutPago() {
  const proveedor = proveedorConfigurado();
  if (!proveedor) {
    throw new PasarelaPagoError('El pago en línea aún no está configurado.');
  }

  throw new PasarelaPagoError(
    `La integración con ${proveedor} aún no fue implementada. Configura su adaptador en src/services/paymentGateway.js.`,
    'PROVEEDOR_SIN_ADAPTADOR',
  );
}

module.exports = {
  PasarelaPagoError,
  obtenerEstadoPasarela,
  crearCheckoutPago,
};
