const statusPanel = document.getElementById('status-panel');
const statusTitle = document.getElementById('status-title');
const statusMessage = document.getElementById('status-message');
const productDetail = document.getElementById('product-detail');

function textoSeguro(valor, alternativa = '') {
  return typeof valor === 'string' ? valor : alternativa;
}

function formatearPrecio(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? `S/ ${numero.toFixed(2)}` : 'Precio por consultar';
}

function mostrarEstado(titulo, mensaje) {
  productDetail.hidden = true;
  productDetail.replaceChildren();
  statusTitle.textContent = titulo;
  statusMessage.textContent = mensaje;
  statusPanel.hidden = false;
}

function crearPlaceholder(clase = 'image-placeholder', texto = 'Imagen no disponible') {
  const placeholder = document.createElement('div');
  placeholder.className = clase;
  placeholder.textContent = texto;
  return placeholder;
}

function crearImagen(imagen, clase, textoAlternativo, clasePlaceholder) {
  if (!imagen || !textoSeguro(imagen.url)) {
    return crearPlaceholder(clasePlaceholder);
  }

  const elementoImagen = document.createElement('img');
  elementoImagen.className = clase;
  elementoImagen.src = imagen.url;
  elementoImagen.alt = textoSeguro(imagen.texto_alternativo, textoAlternativo);
  elementoImagen.addEventListener('error', () => {
    elementoImagen.replaceWith(crearPlaceholder(clasePlaceholder));
  }, { once: true });
  return elementoImagen;
}

function crearDato(nombre, valor) {
  const item = document.createElement('div');
  item.className = 'info-item';

  const etiqueta = document.createElement('span');
  etiqueta.className = 'info-label';
  etiqueta.textContent = nombre;

  const contenido = document.createElement('span');
  contenido.className = 'info-value';
  contenido.textContent = valor;

  item.append(etiqueta, contenido);
  return item;
}

function crearControlesCompra(producto) {
  const controles = document.createElement('div');
  controles.className = 'purchase-controls';
  const stock = Math.max(0, Number.parseInt(producto.stock, 10) || 0);

  if (stock === 0) {
    const agotado = document.createElement('p');
    agotado.className = 'stock-alert';
    agotado.textContent = 'Agotado';

    const botonAgotado = document.createElement('button');
    botonAgotado.className = 'cart-button';
    botonAgotado.type = 'button';
    botonAgotado.disabled = true;
    botonAgotado.textContent = 'Producto agotado';
    controles.append(agotado, botonAgotado);
    return controles;
  }

  let cantidad = 1;
  const etiqueta = document.createElement('span');
  etiqueta.className = 'quantity-label';
  etiqueta.textContent = 'Cantidad';

  const selector = document.createElement('div');
  selector.className = 'quantity-control';
  const disminuir = document.createElement('button');
  disminuir.type = 'button';
  disminuir.textContent = '−';
  disminuir.setAttribute('aria-label', 'Disminuir cantidad');

  const entrada = document.createElement('input');
  entrada.type = 'number';
  entrada.min = '1';
  entrada.max = String(stock);
  entrada.value = String(cantidad);
  entrada.setAttribute('aria-label', 'Cantidad');

  const aumentar = document.createElement('button');
  aumentar.type = 'button';
  aumentar.textContent = '+';
  aumentar.setAttribute('aria-label', 'Aumentar cantidad');

  const sincronizarCantidad = () => {
    entrada.value = String(cantidad);
    disminuir.disabled = cantidad <= 1;
    aumentar.disabled = cantidad >= stock;
  };

  disminuir.addEventListener('click', () => {
    cantidad = Math.max(1, cantidad - 1);
    sincronizarCantidad();
  });
  aumentar.addEventListener('click', () => {
    cantidad = Math.min(stock, cantidad + 1);
    sincronizarCantidad();
  });
  entrada.addEventListener('change', () => {
    const solicitada = Number.parseInt(entrada.value, 10);
    cantidad = Number.isInteger(solicitada) ? Math.min(stock, Math.max(1, solicitada)) : 1;
    sincronizarCantidad();
  });
  sincronizarCantidad();
  selector.append(disminuir, entrada, aumentar);

  const feedback = document.createElement('p');
  feedback.className = 'cart-feedback';
  feedback.setAttribute('role', 'status');

  const botonCarrito = document.createElement('button');
  botonCarrito.className = 'cart-button';
  botonCarrito.type = 'button';
  botonCarrito.textContent = 'Agregar al carrito';
  botonCarrito.addEventListener('click', () => {
    try {
      const item = window.HorusCart.agregarProducto({
        producto_id: producto.id,
        slug: producto.slug,
        cantidad,
        stock,
      });
      feedback.textContent = `Producto agregado. Tienes ${item.cantidad} unidad${item.cantidad === 1 ? '' : 'es'} de este producto en el carrito.`;
    } catch (error) {
      feedback.textContent = textoSeguro(error.message, 'No se pudo agregar el producto al carrito.');
    }
  });

  controles.append(etiqueta, selector, botonCarrito, feedback);
  return controles;
}

function renderizarGaleria(contenedor, imagenes, indicePrincipal, nombreProducto) {
  const restantes = imagenes.filter((imagen, indice) => indice !== indicePrincipal);
  if (restantes.length === 0) return;

  const galeria = document.createElement('section');
  galeria.className = 'gallery';

  const titulo = document.createElement('p');
  titulo.className = 'gallery-title';
  titulo.textContent = 'Más imágenes';

  const rejilla = document.createElement('div');
  rejilla.className = 'gallery-grid';

  restantes.forEach((imagen) => {
    rejilla.append(crearImagen(imagen, 'gallery-image', nombreProducto, 'gallery-placeholder'));
  });

  galeria.append(titulo, rejilla);
  contenedor.append(galeria);
}

function renderizarProducto(producto) {
  productDetail.replaceChildren();

  const imagenes = Array.isArray(producto.imagenes) ? producto.imagenes : [];
  const indicePrincipal = imagenes.findIndex((imagen) => imagen.principal);
  const indiceImagen = indicePrincipal >= 0 ? indicePrincipal : 0;
  const imagenPrincipal = imagenes[indiceImagen];
  const nombreProducto = textoSeguro(producto.nombre, 'Producto');

  const media = document.createElement('div');
  media.className = 'product-media';
  media.append(crearImagen(imagenPrincipal, 'product-main-image', nombreProducto, 'image-placeholder'));
  renderizarGaleria(media, imagenes, indicePrincipal >= 0 ? indicePrincipal : 0, nombreProducto);

  const resumen = document.createElement('div');
  resumen.className = 'product-summary';

  const categoria = document.createElement('p');
  categoria.className = 'product-category';
  categoria.textContent = textoSeguro(producto.categoria?.nombre, 'Sin categoría');

  const encabezado = document.createElement('div');
  encabezado.className = 'product-heading-row';

  const nombre = document.createElement('h1');
  nombre.className = 'product-name';
  nombre.textContent = nombreProducto;
  encabezado.append(nombre);

  if (producto.destacado) {
    const destacado = document.createElement('span');
    destacado.className = 'featured-badge';
    destacado.textContent = 'Destacado';
    encabezado.append(destacado);
  }

  const precio = document.createElement('p');
  precio.className = 'product-price';
  precio.textContent = formatearPrecio(producto.precio);

  const descripcionCorta = document.createElement('p');
  descripcionCorta.className = 'short-description';
  descripcionCorta.textContent = textoSeguro(producto.descripcion_corta, 'Sin descripción disponible.');

  const datos = document.createElement('div');
  datos.className = 'info-list';
  const unidades = Number(producto.stock);
  datos.append(
    crearDato('Stock', Number.isFinite(unidades) ? `${unidades} unidades` : 'No disponible'),
    crearDato('SKU', textoSeguro(producto.sku, 'No disponible')),
  );

  resumen.append(categoria, encabezado, precio, descripcionCorta, datos, crearControlesCompra(producto));

  const descripcionSeccion = document.createElement('section');
  descripcionSeccion.className = 'product-description-section';

  const tituloDescripcion = document.createElement('h2');
  tituloDescripcion.className = 'section-title';
  tituloDescripcion.textContent = 'Descripción del producto';

  const descripcionCompleta = document.createElement('p');
  descripcionCompleta.className = 'full-description';
  descripcionCompleta.textContent = textoSeguro(producto.descripcion, textoSeguro(producto.descripcion_corta, 'Sin descripción disponible.'));

  descripcionSeccion.append(tituloDescripcion, descripcionCompleta);
  productDetail.append(media, resumen, descripcionSeccion);
  productDetail.hidden = false;
  statusPanel.hidden = true;
}

async function cargarProducto() {
  const slug = new URLSearchParams(window.location.search).get('slug')?.trim();

  if (!slug) {
    mostrarEstado('Producto inválido', 'No se indicó el producto que deseas consultar.');
    return;
  }

  try {
    const respuesta = await fetch('/api/productos/' + encodeURIComponent(slug));
    const datos = await respuesta.json();

    if (respuesta.status === 404) {
      mostrarEstado('Producto no encontrado', 'El producto solicitado no existe o ya no está disponible.');
      return;
    }

    if (!respuesta.ok || !datos.ok || !datos.producto) {
      throw new Error(textoSeguro(datos.mensaje, 'No se pudo cargar el producto.'));
    }

    renderizarProducto(datos.producto);
  } catch (error) {
    mostrarEstado('No fue posible cargar el producto', textoSeguro(error.message, 'Inténtalo nuevamente más tarde.'));
  }
}

document.addEventListener('DOMContentLoaded', cargarProducto);
