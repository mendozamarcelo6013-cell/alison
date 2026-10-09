import { useEffect, useMemo, useState } from 'react';
import { obtenerCatalogo } from '../api/productos';
import { mensajeError } from '../api/client';
import { SiteFooter } from '../components/SiteFooter';
import { EnlaceAdmin, EnlaceCarrito, SiteHeader } from '../components/SiteHeader';
import { ProductoImagen } from '../components/ProductoImagen';
import { useCart } from '../state/CartContext';
import { formatearPrecio, normalizarTexto, textoSeguro } from '../utils/format';
import type { Categoria, ProductoCatalogo } from '../types';
import '../../../public/css/market-shared.css';
import '../../../public/css/market.css';

interface TarjetaProductoProps {
  producto: ProductoCatalogo;
}

function TarjetaProducto({ producto }: TarjetaProductoProps) {
  const imagenes = Array.isArray(producto.imagenes) ? producto.imagenes : [];
  const imagen = imagenes.find((item) => item.principal) || imagenes[0];
  const unidades = Number(producto.stock);

  const disponibilidad = producto.controla_stock === false
    ? 'Disponible'
    : (Number.isFinite(unidades) ? `Stock: ${unidades} unidades` : 'Stock no disponible');

  return (
    <article className="product-card">
      <ProductoImagen
        url={imagen?.url}
        alt={textoSeguro(imagen?.texto_alternativo, textoSeguro(producto.nombre, 'Producto'))}
        className="product-image"
        placeholderClassName="image-placeholder"
      />
      <div className="product-content">
        <div className="product-meta">
          <span className="category-label">
            {textoSeguro(producto.categoria?.nombre, 'Sin categoría')}
          </span>
          {producto.destacado ? <span className="featured-badge">Destacado</span> : null}
        </div>
        <h3 className="product-name">{textoSeguro(producto.nombre, 'Producto sin nombre')}</h3>
        <p className="product-description">
          {textoSeguro(producto.descripcion_corta, 'Sin descripción disponible.')}
        </p>
        <div className="product-footer">
          <div>
            <strong className="price">{formatearPrecio(producto.precio)}</strong>
            <span className="stock">{disponibilidad}</span>
          </div>
          <a
            className="product-link"
            href={`market-producto.html?slug=${encodeURIComponent(textoSeguro(producto.slug))}`}
          >
            Ver producto
          </a>
        </div>
      </div>
    </article>
  );
}

type EstadoCatalogo = 'cargando' | 'error' | 'listo';

export function CatalogoPage() {
  const { unidades } = useCart();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState<EstadoCatalogo>('cargando');
  const [mensajeErrorEstado, setMensajeError] = useState('');
  const [contadorVisible, setContadorVisible] = useState(false);

  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const catalogo = await obtenerCatalogo();
        if (!vigente) return;
        setCategorias(catalogo.categorias);
        setProductos(catalogo.productos);
        setEstado('listo');
        setContadorVisible(true);
      } catch (error) {
        if (!vigente) return;
        setMensajeError(mensajeError(error, 'No se pudo conectar con el catálogo.'));
        setEstado('error');
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  const productosFiltrados = useMemo(() => {
    const consulta = normalizarTexto(busqueda.trim());
    return productos.filter((producto) => {
      const coincideCategoria = !categoriaActiva || producto.categoria?.slug === categoriaActiva;
      const contenido = [
        producto.nombre,
        producto.descripcion_corta,
        producto.descripcion,
        producto.categoria?.nombre,
      ].map(normalizarTexto).join(' ');
      return coincideCategoria && (!consulta || contenido.includes(consulta));
    });
  }, [productos, categoriaActiva, busqueda]);

  const total = productos.length;
  const etiquetaConteo = `${productosFiltrados.length} de ${total} producto${total === 1 ? '' : 's'}`;

  return (
    <>
      <SiteHeader hrefMarca="market.html" etiquetaMarca="Horus Market, inicio">
        <div className="header-actions header-actions--doble">
          <label className="search-box" htmlFor="catalog-search">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              id="catalog-search"
              type="search"
              placeholder="Buscar productos"
              aria-label="Buscar productos"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
            />
          </label>
          <EnlaceAdmin />
          <EnlaceCarrito unidades={unidades} iconoCatalogo />
        </div>
      </SiteHeader>

      <main>
        <section className="catalog-intro" aria-labelledby="market-title">
          <div>
            <p className="eyebrow">Catálogo en línea</p>
            <h1 id="market-title">Market</h1>
            <p className="intro-copy">Explora productos y soluciones disponibles en Horus Group.</p>
          </div>
        </section>

        <section className="catalog-section products-section" aria-labelledby="products-title">
          <div className="catalog-layout">
            <aside className="catalog-filters" aria-labelledby="categories-title">
              <p className="eyebrow">Explora por tipo</p>
              <h2 id="categories-title">Categorías</h2>
              <div id="categories-list" className="categories-list" role="group" aria-label="Filtrar productos por categoría">
                <button
                  type="button"
                  className={`filter-button${categoriaActiva === '' ? ' active' : ''}`}
                  aria-pressed={categoriaActiva === ''}
                  onClick={() => setCategoriaActiva('')}
                >
                  Todos los productos
                </button>
                {categorias.map((categoria) => {
                  const activo = categoriaActiva === categoria.slug;
                  return (
                    <button
                      key={categoria.id}
                      type="button"
                      className={`filter-button${activo ? ' active' : ''}`}
                      aria-pressed={activo}
                      onClick={() => setCategoriaActiva(textoSeguro(categoria.slug))}
                    >
                      {textoSeguro(categoria.nombre, 'Sin nombre')}
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="catalog-products">
              <div className="section-heading products-heading">
                <div>
                  <p className="eyebrow">Disponible ahora</p>
                  <h2 id="products-title">Productos</h2>
                </div>
                <span
                  id="product-count"
                  className="product-count"
                  hidden={!contadorVisible}
                >
                  {etiquetaConteo}
                </span>
              </div>

              <p id="loading-state" className="state-message" role="status" hidden={estado !== 'cargando'}>
                Cargando catálogo…
              </p>
              <div
                id="error-state"
                className="state-message error-state"
                role="alert"
                hidden={estado !== 'error'}
              >
                {mensajeErrorEstado}
              </div>
              <p id="empty-state" className="state-message" hidden={!(estado === 'listo' && productosFiltrados.length === 0)}>
                No encontramos productos con esos filtros.
              </p>
              <div id="products-grid" className="products-grid" aria-live="polite">
                {estado === 'listo'
                  ? productosFiltrados.map((producto) => (
                    <TarjetaProducto key={producto.id} producto={producto} />
                  ))
                  : null}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
