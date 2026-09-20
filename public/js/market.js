const categoriesList = document.getElementById('categories-list');
const productsGrid = document.getElementById('products-grid');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const emptyState = document.getElementById('empty-state');
const productCount = document.getElementById('product-count');
const searchInput = document.getElementById('catalog-search');

let categorias = [];
let productos = [];
let categoriaActiva = '';

function textoSeguro(valor, alternativa = '') {
  return typeof valor === 'string' ? valor : alternativa;
}

function normalizarTexto(valor) {
  return textoSeguro(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

function formatearPrecio(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? `S/ ${numero.toFixed(2)}` : 'Precio por consultar';
}

function crearImagenProducto(producto) {
  const imagenes = Array.isArray(producto.imagenes) ? producto.imagenes : [];
  const imagen = imagenes.find((item) => item.principal) || imagenes[0];
  if (!imagen || !textoSeguro(imagen.url)) {
    const placeholder = document.createElement('div');
    placeholder.className = 'image-placeholder';
    placeholder.textContent = 'Imagen no disponible';
    return placeholder;
  }

  const elementoImagen = document.createElement('img');
  elementoImagen.className = 'product-image';
  elementoImagen.src = imagen.url;
  elementoImagen.alt = textoSeguro(imagen.texto_alternativo, textoSeguro(producto.nombre, 'Producto'));
  elementoImagen.addEventListener('error', () => {
    const placeholder = document.createElement('div');
    placeholder.className = 'image-placeholder';
    placeholder.textContent = 'Imagen no disponible';
    elementoImagen.replaceWith(placeholder);
  }, { once: true });
  return elementoImagen;
}

function crearBotonFiltro(nombre, slug) {
  const boton = document.createElement('button');
  const activo = categoriaActiva === slug;
  boton.className = `filter-button${activo ? ' active' : ''}`;
  boton.type = 'button';
  boton.textContent = nombre;
  boton.setAttribute('aria-pressed', String(activo));
  boton.addEventListener('click', () => {
    categoriaActiva = slug;
    renderizarCategorias();
    actualizarResultados();
  });
  return boton;
}

function renderizarCategorias() {
  categoriesList.replaceChildren();
  categoriesList.append(crearBotonFiltro('Todos los productos', ''));
  categorias.forEach((categoria) => {
    categoriesList.append(crearBotonFiltro(
      textoSeguro(categoria.nombre, 'Sin nombre'),
      textoSeguro(categoria.slug),
    ));
  });
}

function renderizarProductos(productosFiltrados) {
  productsGrid.replaceChildren();
  productosFiltrados.forEach((producto) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'product-card';
    tarjeta.append(crearImagenProducto(producto));

    const contenido = document.createElement('div');
    contenido.className = 'product-content';
    const meta = document.createElement('div');
    meta.className = 'product-meta';
    const categoria = document.createElement('span');
    categoria.className = 'category-label';
    categoria.textContent = textoSeguro(producto.categoria?.nombre, 'Sin categoría');
    meta.append(categoria);

    if (producto.destacado) {
      const destacado = document.createElement('span');
      destacado.className = 'featured-badge';
      destacado.textContent = 'Destacado';
      meta.append(destacado);
    }

    const nombre = document.createElement('h3');
    nombre.className = 'product-name';
    nombre.textContent = textoSeguro(producto.nombre, 'Producto sin nombre');
    const descripcion = document.createElement('p');
    descripcion.className = 'product-description';
    descripcion.textContent = textoSeguro(producto.descripcion_corta, 'Sin descripción disponible.');

    const pie = document.createElement('div');
    pie.className = 'product-footer';
    const informacion = document.createElement('div');
    const precio = document.createElement('strong');
    precio.className = 'price';
    precio.textContent = formatearPrecio(producto.precio);
    const stock = document.createElement('span');
    stock.className = 'stock';
    const unidades = Number(producto.stock);
    stock.textContent = producto.controla_stock === false
      ? 'Disponible'
      : (Number.isFinite(unidades) ? `Stock: ${unidades} unidades` : 'Stock no disponible');
    informacion.append(precio, stock);

    const enlace = document.createElement('a');
    enlace.className = 'product-link';
    enlace.textContent = 'Ver producto';
    enlace.href = `market-producto.html?slug=${encodeURIComponent(textoSeguro(producto.slug))}`;
    pie.append(informacion, enlace);
    contenido.append(meta, nombre, descripcion, pie);
    tarjeta.append(contenido);
    productsGrid.append(tarjeta);
  });
}

function filtrarProductos() {
  const busqueda = normalizarTexto(searchInput.value.trim());
  return productos.filter((producto) => {
    const coincideCategoria = !categoriaActiva || producto.categoria?.slug === categoriaActiva;
    const contenido = [producto.nombre, producto.descripcion_corta, producto.descripcion, producto.categoria?.nombre]
      .map(normalizarTexto)
      .join(' ');
    return coincideCategoria && (!busqueda || contenido.includes(busqueda));
  });
}

function actualizarResultados() {
  const productosFiltrados = filtrarProductos();
  renderizarProductos(productosFiltrados);
  emptyState.hidden = productosFiltrados.length > 0;
  productCount.textContent = `${productosFiltrados.length} de ${productos.length} producto${productos.length === 1 ? '' : 's'}`;
  productCount.hidden = false;
}

async function obtenerRespuesta(url) {
  const respuesta = await fetch(url);
  const datos = await respuesta.json();
  if (!respuesta.ok || !datos.ok) {
    throw new Error(textoSeguro(datos.mensaje, 'No se pudo cargar el catálogo.'));
  }
  return datos;
}

async function cargarCatalogo() {
  loadingState.hidden = false;
  errorState.hidden = true;
  emptyState.hidden = true;
  try {
    const [respuestaCategorias, respuestaProductos] = await Promise.all([
      obtenerRespuesta('/api/categorias'),
      obtenerRespuesta('/api/productos'),
    ]);
    categorias = Array.isArray(respuestaCategorias.categorias) ? respuestaCategorias.categorias : [];
    productos = Array.isArray(respuestaProductos.productos) ? respuestaProductos.productos : [];
    renderizarCategorias();
    actualizarResultados();
  } catch (error) {
    errorState.textContent = textoSeguro(error.message, 'No se pudo conectar con el catálogo.');
    errorState.hidden = false;
  } finally {
    loadingState.hidden = true;
  }
}

searchInput.addEventListener('input', actualizarResultados);
document.addEventListener('DOMContentLoaded', cargarCatalogo);
