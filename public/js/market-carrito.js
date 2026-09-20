const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const emptyState = document.getElementById('empty-state');
const cartContent = document.getElementById('cart-content');
const cartItems = document.getElementById('cart-items');
const subtotalElement = document.getElementById('subtotal');
const checkoutButton = document.getElementById('checkout-button');

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

function crearImagen(producto) {
  const imagenes = Array.isArray(producto.imagenes) ? producto.imagenes : [];
  const imagen = imagenes.find((item) => item.principal) || imagenes[0];
  if (!imagen || !textoSeguro(imagen.url)) return crearPlaceholder();

  const elemento = document.createElement('img');
  elemento.className = 'item-image';
  elemento.src = imagen.url;
  elemento.alt = textoSeguro(imagen.texto_alternativo, textoSeguro(producto.nombre, 'Producto'));
  elemento.addEventListener('error', () => elemento.replaceWith(crearPlaceholder()), { once: true });
  return elemento;
}

function crearPlaceholder() {
  const placeholder = document.createElement('div');
  placeholder.className = 'item-placeholder';
  placeholder.textContent = 'Imagen no disponible';
  return placeholder;
}

async function consultarProducto(item) {
  try {
    const respuesta = await fetch('/api/productos/' + encodeURIComponent(item.slug));
    const datos = await respuesta.json();

    if (respuesta.status === 404) return { item, estado: 'no-disponible' };
    if (!respuesta.ok || !datos.ok || !datos.producto) {
      return { item, estado: 'error' };
    }

    const controlaStock = datos.producto.controla_stock !== false;
    const stock = controlaStock
      ? Math.max(0, Number.parseInt(datos.producto.stock, 10) || 0)
      : 99;
    const itemActualizado = stock > 0 && item.cantidad > stock
      ? window.HorusCart.actualizarCantidad(item.slug, stock, stock)
      : item;

    return {
      item: itemActualizado || item,
      producto: datos.producto,
      stock,
      estado: controlaStock && stock === 0 ? 'agotado' : 'disponible',
    };
  } catch {
    return { item, estado: 'error' };
  }
}

function crearBoton(texto, accion, deshabilitado = false) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.textContent = texto;
  boton.disabled = deshabilitado;
  boton.addEventListener('click', accion);
  return boton;
}

function renderizarItem(registro, registros) {
  const tarjeta = document.createElement('article');
  tarjeta.className = 'cart-item';

  const producto = registro.producto;
  if (!producto) {
    tarjeta.append(crearPlaceholder());
    const texto = document.createElement('div');
    const nombre = document.createElement('h2');
    nombre.className = 'item-name';
    nombre.textContent = 'Producto no disponible';
    const aviso = document.createElement('p');
    aviso.className = 'availability unavailable';
    aviso.textContent = registro.estado === 'error'
      ? 'No fue posible validar este producto ahora.'
      : 'Este producto ya no existe o está inactivo.';
    texto.append(nombre, aviso);
    tarjeta.append(texto);
  } else {
    tarjeta.append(crearImagen(producto));
    const detalle = document.createElement('div');
    const categoria = document.createElement('span');
    categoria.className = 'item-category';
    categoria.textContent = textoSeguro(producto.categoria?.nombre, 'Sin categoría');
    const nombre = document.createElement('h2');
    nombre.className = 'item-name';
    nombre.textContent = textoSeguro(producto.nombre, 'Producto');
    const sku = document.createElement('span');
    sku.className = 'item-sku';
    sku.textContent = `SKU: ${textoSeguro(producto.sku, 'No disponible')}`;
    const stock = document.createElement('span');
    stock.className = 'item-stock';
    stock.textContent = producto.controla_stock === false
      ? 'Disponibilidad: inmediata'
      : `Stock disponible: ${registro.stock} unidades`;
    const estado = document.createElement('p');
    estado.className = `availability${registro.estado === 'agotado' ? ' unavailable' : ''}`;
    estado.textContent = registro.estado === 'agotado' ? 'Agotado' : 'Disponible';
    detalle.append(categoria, nombre, sku, stock, estado);
    tarjeta.append(detalle);
  }

  const acciones = document.createElement('div');
  acciones.className = 'item-actions';

  if (producto) {
    const precioUnitario = document.createElement('span');
    precioUnitario.className = 'item-price';
    precioUnitario.textContent = `Unitario: ${precioTexto(producto.precio)}`;
    const subtotal = document.createElement('strong');
    subtotal.className = 'item-subtotal';
    subtotal.textContent = `Subtotal: ${precioTexto(precio(producto.precio) * registro.item.cantidad)}`;

    const cantidad = document.createElement('div');
    cantidad.className = 'quantity-control';
    const agotado = registro.estado === 'agotado';
    cantidad.append(
      crearBoton('−', () => cambiarCantidad(registro, registros, registro.item.cantidad - 1), agotado || registro.item.cantidad <= 1),
      Object.assign(document.createElement('span'), { className: 'quantity-value', textContent: String(registro.item.cantidad) }),
      crearBoton('+', () => cambiarCantidad(registro, registros, registro.item.cantidad + 1), agotado || registro.item.cantidad >= registro.stock),
    );
    acciones.append(precioUnitario, subtotal, cantidad);
  }

  const eliminar = crearBoton('Eliminar', () => {
    window.HorusCart.eliminarProducto(registro.item.slug);
    cargarCarrito();
  });
  eliminar.className = 'remove-button';
  acciones.append(eliminar);
  tarjeta.append(acciones);
  return tarjeta;
}

function cambiarCantidad(registro, registros, cantidad) {
  const actualizado = window.HorusCart.actualizarCantidad(registro.item.slug, cantidad, registro.stock);
  if (!actualizado) return;
  registro.item = actualizado;
  renderizarCarrito(registros);
}

function renderizarCarrito(registros) {
  cartItems.replaceChildren();
  registros.forEach((registro) => cartItems.append(renderizarItem(registro, registros)));

  const subtotal = registros
    .filter((registro) => registro.producto && registro.estado === 'disponible')
    .reduce((total, registro) => total + precio(registro.producto.precio) * registro.item.cantidad, 0);
  subtotalElement.textContent = precioTexto(subtotal);

  const contieneProductoNoDisponible = registros.some(
    (registro) => !registro.producto || registro.estado !== 'disponible',
  );
  const hayProductosDisponibles = registros.some(
    (registro) => registro.producto && registro.estado === 'disponible',
  );
  checkoutButton.disabled = contieneProductoNoDisponible || !hayProductosDisponibles;
  checkoutButton.title = checkoutButton.disabled
    ? 'Elimina o actualiza los productos no disponibles para continuar.'
    : '';
}

async function cargarCarrito() {
  loadingState.hidden = false;
  errorState.hidden = true;
  emptyState.hidden = true;
  cartContent.hidden = true;

  const carrito = window.HorusCart.obtenerCarrito();
  if (carrito.length === 0) {
    loadingState.hidden = true;
    emptyState.hidden = false;
    return;
  }

  const registros = await Promise.all(carrito.map(consultarProducto));
  const hayError = registros.some((registro) => registro.estado === 'error');
  if (hayError) {
    errorState.textContent = 'Algunos productos no pudieron validarse. Puedes eliminarlos o intentar nuevamente.';
    errorState.hidden = false;
  }

  renderizarCarrito(registros);
  cartContent.hidden = false;
  loadingState.hidden = true;
}

document.addEventListener('DOMContentLoaded', cargarCarrito);

checkoutButton.addEventListener('click', () => {
  if (!checkoutButton.disabled) {
    window.location.assign('/market-checkout.html');
  }
});
