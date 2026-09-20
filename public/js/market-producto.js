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
  const controlaStock = producto.controla_stock !== false;
  const stock = controlaStock
    ? Math.max(0, Number.parseInt(producto.stock, 10) || 0)
    : 99;

  if (controlaStock && stock === 0) {
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
      window.HorusCart.agregarProducto({
        producto_id: producto.id,
        slug: producto.slug,
        cantidad,
        stock,
      });
      feedback.textContent = 'Producto agregado. Abriendo tu carrito…';
      window.location.assign('/market-carrito.html');
    } catch (error) {
      feedback.textContent = textoSeguro(error.message, 'No se pudo agregar el producto al carrito.');
    }
  });

  controles.append(etiqueta, selector, botonCarrito, feedback);
  return controles;
}

function renderizarGaleria(contenedor, imagenes, nombreProducto) {
  if (!imagenes.length) {
    contenedor.append(crearPlaceholder('image-placeholder'));
    return;
  }

  let indiceActual = 0;
  const marco = document.createElement('div');
  marco.className = 'gallery-frame';
  const capaImagen = document.createElement('div');
  capaImagen.className = 'gallery-image-layer';
  const imagen = crearImagen(imagenes[0], 'product-main-image', nombreProducto, 'image-placeholder');
  capaImagen.append(imagen);
  marco.append(capaImagen);
  contenedor.append(marco);
  if (imagenes.length === 1) return;

  const cambiarImagen = (indice) => {
    indiceActual = (indice + imagenes.length) % imagenes.length;
    const nueva = crearImagen(imagenes[indiceActual], 'product-main-image', nombreProducto, 'image-placeholder');
    nueva.classList.add('gallery-image-enter');
    capaImagen.replaceChildren(nueva);
    puntos.querySelectorAll('.gallery-dot').forEach((punto, puntoIndice) => {
      punto.classList.toggle('active', puntoIndice === indiceActual);
      punto.setAttribute('aria-current', puntoIndice === indiceActual ? 'true' : 'false');
    });
  };

  const anterior = document.createElement('button');
  anterior.type = 'button';
  anterior.className = 'gallery-arrow gallery-previous';
  anterior.textContent = '‹';
  anterior.setAttribute('aria-label', 'Imagen anterior');
  anterior.addEventListener('click', () => cambiarImagen(indiceActual - 1));
  const siguiente = document.createElement('button');
  siguiente.type = 'button';
  siguiente.className = 'gallery-arrow gallery-next';
  siguiente.textContent = '›';
  siguiente.setAttribute('aria-label', 'Imagen siguiente');
  siguiente.addEventListener('click', () => cambiarImagen(indiceActual + 1));
  marco.append(anterior, siguiente);

  const puntos = document.createElement('div');
  puntos.className = 'gallery-dots';
  imagenes.forEach((imagenProducto, indice) => {
    const punto = document.createElement('button');
    punto.type = 'button';
    punto.className = `gallery-dot${indice === 0 ? ' active' : ''}`;
    punto.setAttribute('aria-label', `Ver imagen ${indice + 1}`);
    punto.setAttribute('aria-current', indice === 0 ? 'true' : 'false');
    punto.addEventListener('click', () => cambiarImagen(indice));
    puntos.append(punto);
  });
  contenedor.append(puntos);
}

function renderizarProducto(producto) {
  productDetail.replaceChildren();

  const imagenes = Array.isArray(producto.imagenes) ? producto.imagenes : [];
  const imagenesOrdenadas = [...imagenes].sort((a, b) => {
    if (Boolean(a.principal) !== Boolean(b.principal)) return a.principal ? -1 : 1;
    return Number(a.orden || 0) - Number(b.orden || 0);
  });
  const nombreProducto = textoSeguro(producto.nombre, 'Producto');

  const media = document.createElement('div');
  media.className = 'product-media';
  renderizarGaleria(media, imagenesOrdenadas, nombreProducto);

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
    crearDato('Stock', producto.controla_stock === false ? 'Disponible' : (Number.isFinite(unidades) ? `${unidades} unidades` : 'No disponible')),
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
