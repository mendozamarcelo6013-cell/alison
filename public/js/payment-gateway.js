/*
 * Punto de integración para una pasarela de pago.
 *
 * Cuando se elija el proveedor, el backend debe exponer POST /api/pagos/checkout
 * y responder { ok: true, checkout_url: 'https://...' }. La URL debe provenir
 * del servidor; nunca se deben enviar o guardar datos de tarjeta en este sitio.
 */
(() => {
  async function iniciarPago(pedido) {
    const respuesta = await fetch('/api/pagos/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero_pedido: pedido.numero_pedido }),
    });
    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.ok || !datos.checkout_url) {
      throw new Error(datos.mensaje || 'No se pudo iniciar el pago en línea.');
    }

    window.location.assign(datos.checkout_url);
  }

  window.HorusPayments = { iniciarPago };
})();
