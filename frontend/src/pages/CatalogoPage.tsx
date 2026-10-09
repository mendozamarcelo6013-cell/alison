import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { obtenerCatalogo } from '../api/productos';
import { mensajeError } from '../api/client';
import { SiteFooter } from '../components/SiteFooter';
import { EnlaceCarrito, SiteHeader } from '../components/SiteHeader';
import { ProductoImagen } from '../components/ProductoImagen';
import { useCart } from '../state/CartContext';
import { formatearPrecio, normalizarTexto, textoSeguro } from '../utils/format';
import { construirArbol, idsDescendientes, type CategoriaNodo } from '../utils/categorias';
import type { Categoria, ProductoCatalogo } from '../types';

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
          <Link
            className="product-link"
            to={`/market/producto/${encodeURIComponent(textoSeguro(producto.slug))}`}
          >
            Ver producto
          </Link>
        </div>
      </div>
    </article>
  );
}

function destinosExternos(): Record<string, string> {
  const valor = (import.meta.env as Record<string, string | undefined>).VITE_CATEGORY_EXTERNAL_URLS;
  if (!valor) return {};
  try {
    const datos = JSON.parse(valor) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(datos).filter(([, url]) => {
      if (typeof url !== 'string' || !url.trim()) return false;
      try {
        const destino = new URL(url);
        return destino.protocol === 'http:' || destino.protocol === 'https:';
      } catch {
        return false;
      }
    })) as Record<string, string>;
  } catch {
    return {};
  }
}

interface CategoriaGrupoProps {
  nodo: CategoriaNodo;
  nivel: number;
  categoriaActiva: number | null;
  gruposAbiertos: Set<number>;
  destinos: Record<string, string>;
  onSeleccionar: (id: number) => void;
  onAlternar: (id: number) => void;
}

function CategoriaGrupo({
  nodo,
  nivel,
  categoriaActiva,
  gruposAbiertos,
  destinos,
  onSeleccionar,
  onAlternar,
}: CategoriaGrupoProps) {
  const tieneHijas = nodo.hijas.length > 0;
  const abierto = gruposAbiertos.has(nodo.id);
  const seleccionado = categoriaActiva === nodo.id;
  const destino = destinos[nodo.slug];

  return (
    <div className={`category-node category-node-level-${nivel}`}>
      <div className={`category-row${seleccionado ? ' is-selected' : ''}`}>
        <button
          type="button"
          className="category-select"
          aria-pressed={seleccionado}
          onClick={() => onSeleccionar(nodo.id)}
        >
          <span className="category-icon" aria-hidden="true">{nivel === 0 ? '⌘' : '›'}</span>
          <span>{textoSeguro(nodo.nombre, 'Sin nombre')}</span>
        </button>
        {destino ? (
          <a
            className="category-external"
            href={destino}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir información externa de ${nodo.nombre}`}
          >
            ↗
          </a>
        ) : null}
        {tieneHijas ? (
          <button
            type="button"
            className="category-toggle"
            aria-label={`${abierto ? 'Contraer' : 'Expandir'} ${nodo.nombre}`}
            aria-expanded={abierto}
            onClick={() => onAlternar(nodo.id)}
          >
            {abierto ? '⌃' : '⌄'}
          </button>
        ) : null}
      </div>
      {tieneHijas && abierto ? (
        <div className="category-children">
          {nodo.hijas.map((hija) => (
            <CategoriaGrupo
              key={hija.id}
              nodo={hija}
              nivel={nivel + 1}
              categoriaActiva={categoriaActiva}
              gruposAbiertos={gruposAbiertos}
              destinos={destinos}
              onSeleccionar={onSeleccionar}
              onAlternar={onAlternar}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

type EstadoCatalogo = 'cargando' | 'error' | 'listo';

export function CatalogoPage() {
  const { unidades } = useCart();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState<number | null>(null);
  const [gruposAbiertos, setGruposAbiertos] = useState<Set<number>>(new Set());
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

  useEffect(() => {
    setGruposAbiertos(new Set(categorias.filter((categoria) => categoria.parent_id == null).map((categoria) => categoria.id)));
  }, [categorias]);

  const arbolCategorias = useMemo(() => construirArbol(categorias), [categorias]);
  const destinos = useMemo(() => destinosExternos(), []);

  const productosFiltrados = useMemo(() => {
    const consulta = normalizarTexto(busqueda.trim());
    const idsPermitidos = categoriaActiva === null ? null : idsDescendientes(categorias, categoriaActiva);
    return productos.filter((producto) => {
      const coincideCategoria = idsPermitidos === null
        || (producto.categoria?.id != null && idsPermitidos.has(producto.categoria.id));
      const contenido = [
        producto.nombre,
        producto.descripcion_corta,
        producto.descripcion,
        producto.categoria?.nombre,
      ].map(normalizarTexto).join(' ');
      return coincideCategoria && (!consulta || contenido.includes(consulta));
    });
  }, [productos, categorias, categoriaActiva, busqueda]);

  const alternarGrupo = (id: number) => {
    setGruposAbiertos((anteriores) => {
      const siguientes = new Set(anteriores);
      if (siguientes.has(id)) siguientes.delete(id);
      else siguientes.add(id);
      return siguientes;
    });
  };

  const total = productos.length;
  const etiquetaConteo = `${productosFiltrados.length} de ${total} producto${total === 1 ? '' : 's'}`;

  return (
    <>
      <SiteHeader etiquetaMarca="Horus Market, inicio">
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
                  className={`filter-button${categoriaActiva === null ? ' active' : ''}`}
                  aria-pressed={categoriaActiva === null}
                  onClick={() => setCategoriaActiva(null)}
                >
                  Todos los productos
                </button>
                <div className="category-tree">
                  {arbolCategorias.map((categoria) => (
                    <CategoriaGrupo
                      key={categoria.id}
                      nodo={categoria}
                      nivel={0}
                      categoriaActiva={categoriaActiva}
                      gruposAbiertos={gruposAbiertos}
                      destinos={destinos}
                      onSeleccionar={setCategoriaActiva}
                      onAlternar={alternarGrupo}
                    />
                  ))}
                </div>
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
