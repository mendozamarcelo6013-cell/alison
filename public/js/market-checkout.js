const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const emptyState = document.getElementById('empty-state');
const checkoutContent = document.getElementById('checkout-content');
const checkoutForm = document.getElementById('checkout-form');
const deliverySection = document.getElementById('delivery-section');
const orderItems = document.getElementById('order-items');
const orderTotal = document.getElementById('order-total');
const submitOrder = document.getElementById('submit-order');
const successState = document.getElementById('success-state');
const successMessage = document.getElementById('success-message');
const paymentButton = document.getElementById('payment-button');

let productosValidados = [];
let requiereEntrega = false;
let pedidoCreado = null;

function textoSeguro(valor, alternativa = '') {
  return typeof valor === 'string' ? valor : alternativa;
}

function precio(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function precioTexto(valor) {
  return `S/ ${precio(valor).toFixed(2)}`;
}

function establecerCamposEntrega(requeridos) {
  ['departamento', 'provincia', 'distrito', 'direccion-linea1'].forEach((id) => {
    document.getElementById(id).required = requeridos;
  });
  deliverySection.hidden = !requeridos;
}

async function obtenerProducto(item) {
  const respuesta = await fetch(`/api/productos/${encodeURIComponent(item.slug)}`);
  const datos = await respuesta.json();
  if (!respuesta.ok || !datos.ok || !datos.producto) {
    throw new Error('Uno o más productos ya no están disponibles. Regresa al carrito para actualizarlo.');
  }
  const producto = datos.producto;
  const stock = Number.parseInt(producto.stock, 10) || 0;
  if (producto.controla_stock !== false && (stock <= 0 || item.cantidad > stock)) {
    throw new Error(`La cantidad seleccionada ya no está disponible para ${producto.nombre}. Regresa al carrito para actualizarlo.`);
  }
  return { ...producto, cantidad: item.cantidad };
}

function renderizarResumen(productos) {
  orderItems.replaceChildren();
  let total = 0;
  productos.forEach((producto) => {
    const linea = precio(producto.precio) * producto.cantidad;
    total += linea;
    const item = document.createElement('div');
    item.className = 'order-item';
    const detalle = document.createElement('div');
    const nombre = document.createElement('span');
    nombre.className = 'order-item-name';
    nombre.textContent = textoSeguro(producto.nombre, 'Producto');
    const cantidad = document.createElement('span');
    cantidad.className = 'order-item-qty';
    cantidad.textContent = `Cantidad: ${producto.cantidad}`;
    detalle.append(nombre, cantidad);
    const importe = document.createElement('strong');
    importe.className = 'order-item-price';
    importe.textContent = precioTexto(linea);
    item.append(detalle, importe);
    orderItems.append(item);
  });
  orderTotal.textContent = precioTexto(total);
}

async function cargarCheckout() {
  const carrito = window.HorusCart.obtenerCarrito();
  if (carrito.length === 0) {
    loadingState.hidden = true;
    emptyState.hidden = false;
    return;
  }

  try {
    productosValidados = await Promise.all(carrito.map(obtenerProducto));
    requiereEntrega = productosValidados.some((producto) => producto.tipo === 'fisico');
    establecerCamposEntrega(requiereEntrega);
    renderizarResumen(productosValidados);
    checkoutContent.hidden = false;
  } catch (error) {
    errorState.textContent = textoSeguro(error.message, 'No fue posible validar el carrito.');
    errorState.hidden = false;
  } finally {
    loadingState.hidden = true;
  }
}

function crearPayload() {
  const direccion = requiereEntrega ? {
    departamento: document.getElementById('departamento').value.trim(),
    provincia: document.getElementById('provincia').value.trim(),
    distrito: document.getElementById('distrito').value.trim(),
    direccion_linea1: document.getElementById('direccion-linea1').value.trim(),
    referencia: document.getElementById('referencia').value.trim(),
  } : undefined;

  return {
    email: document.getElementById('email').value.trim(),
    destinatario: document.getElementById('destinatario').value.trim(),
    telefono: document.getElementById('telefono').value.trim(),
    direccion,
    notas: document.getElementById('notas').value.trim(),
    items: productosValidados.map(({ slug, cantidad }) => ({ slug, cantidad })),
  };
}

async function actualizarEstadoPago() {
  try {
    const respuesta = await fetch('/api/pagos/configuracion');
    const datos = await respuesta.json();
    if (respuesta.ok && datos.ok && datos.habilitada === true) {
      paymentButton.disabled = false;
      paymentButton.textContent = 'Pagar en línea';
    }
  } catch {
    // El pedido queda registrado aunque la pasarela aún no esté disponible.
  }
}

checkoutForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorState.hidden = true;
  if (!checkoutForm.reportValidity()) return;

  submitOrder.disabled = true;
  submitOrder.textContent = 'Registrando pedido…';
  try {
    const respuesta = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(crearPayload()),
    });
    const datos = await respuesta.json();
    if (!respuesta.ok || !datos.ok || !datos.pedido) {
      throw new Error(textoSeguro(datos.mensaje, 'No fue posible registrar el pedido.'));
    }

    pedidoCreado = datos.pedido;
    window.HorusCart.guardarCarrito([]);
    sessionStorage.setItem('horus_market_last_order', JSON.stringify(pedidoCreado));
    checkoutContent.hidden = true;
    successMessage.textContent = `Tu pedido ${pedidoCreado.numero_pedido} fue registrado por ${precioTexto(pedidoCreado.total)}. El siguiente paso será completar el pago en línea.`;
    successState.hidden = false;
    actualizarEstadoPago();
  } catch (error) {
    errorState.textContent = textoSeguro(error.message, 'No fue posible registrar el pedido. Inténtalo nuevamente.');
    errorState.hidden = false;
    submitOrder.disabled = false;
    submitOrder.textContent = 'Registrar pedido y continuar';
  }
});

paymentButton.addEventListener('click', async () => {
  if (!pedidoCreado || paymentButton.disabled) return;
  paymentButton.disabled = true;
  paymentButton.textContent = 'Redirigiendo al pago…';
  try {
    await window.HorusPayments.iniciarPago(pedidoCreado);
  } catch (error) {
    errorState.textContent = textoSeguro(error.message, 'No se pudo iniciar el pago en línea.');
    errorState.hidden = false;
    paymentButton.disabled = false;
    paymentButton.textContent = 'Pagar en línea';
  }
});

document.addEventListener('DOMContentLoaded', cargarCheckout);
