import { useEffect, useState } from 'react';
import { consultarProducto } from '../api/productos';
import { ERROR_PRODUCTO, mensajeError } from '../api/client';
import { GaleriaProducto } from '../components/GaleriaProducto';
import { SiteFooter } from '../components/SiteFooter';
import { EnlaceCarrito, SiteHeader } from '../components/SiteHeader';
import { useCart } from '../state/CartContext';
import { formatearPrecio, textoSeguro } from '../utils/format';
import { irA } from '../utils/navigation';
import type { ProductoDetalle } from '../types';
import '../../../public/css/market-shared.css';
import '../../../public/css/market-producto.css';

type EstadoProducto =
  | { fase: 'cargando' }
  | { fase: 'estado'; titulo: string; mensaje: string }
  | { fase: 'listo' };

function DatoProducto({ nombre, valor }: { nombre: string; valor: string }) {
  return (
    <div className="info-item">
      <span className="info-label">{nombre}</span>
      <span className="info-value">{valor}</span>
    </div>
  );
}

interface ControlesProps {
  producto: ProductoDetalle;
}

function ControlesCompra({ producto }: ControlesProps) {
  const { agregar } = useCart();
  const controlaStock = producto.controla_stock !== false;
  const stock = controlaStock ? Math.max(0, Number.parseInt(String(producto.stock), 10) || 0) : 99;

  const [cantidad, setCantidad] = useState(1);
  const [entrada, setEntrada] = useState('1');
  const [mensaje, setMensaje] = useState('');

  if (controlaStock && stock === 0) {
    return (
      <div className="purchase-controls">
        <p className="stock-alert">Agotado</p>
        <button className="cart-button" type="button" disabled>
          Producto agotado
        </button>
      </div>
    );
  }
  const fijarCantidad = (valor: number) => {
    const limitada = Math.min(stock, Math.max(1, valor));
    setCantidad(limitada);
    setEntrada(String(limitada));
  };

  const normalizarEntrada = () => {
    const solicitada = Number.parseInt(entrada, 10);
    fijarCantidad(Number.isInteger(solicitada) ? solicitada : 1);
  };

  const agregarAlCarrito = () => {
    try {
      agregar({
        producto_id: producto.id,
        slug: producto.slug,
        cantidad,
        stock,
      });
      setMensaje('Producto agregado. Abriendo tu carrito…');
      irA('/market-carrito.html');
    } catch (error) {
      setMensaje(mensajeError(error, 'No se pudo agregar el producto al carrito.'));
    }
  };

  return (
    <div className="purchase-controls">
      <span className="quantity-label">Cantidad</span>
      <div className="quantity-control">
        <button
          type="button"
          aria-label="Disminuir cantidad"
          disabled={cantidad <= 1}
          onClick={() => fijarCantidad(cantidad - 1)}
        >
          −
        </button>
        <input
          type="number"
          min="1"
          max={String(stock)}
          value={entrada}
          aria-label="Cantidad"
          onChange={(evento) => setEntrada(evento.target.value)}
          onBlur={normalizarEntrada}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter') normalizarEntrada();
          }}
        />
        <button
          type="button"
          aria-label="Aumentar cantidad"
          disabled={cantidad >= stock}
          onClick={() => fijarCantidad(cantidad + 1)}
        >
          +
        </button>
      </div>
      <button className="cart-button" type="button" onClick={agregarAlCarrito}>
        Agregar al carrito
      </button>
      <p className="cart-feedback" role="status">{mensaje}</p>
    </div>
  );
}

export function ProductoPage() {
  const { unidades } = useCart();
  const [estado, setEstado] = useState<EstadoProducto>({ fase: 'cargando' });
  const [producto, setProducto] = useState<ProductoDetalle | null>(null);

  useEffect(() => {
    let vigente = true;
    const slug = new URLSearchParams(window.location.search).get('slug')?.trim();

    if (!slug) {
      setEstado({
        fase: 'estado',
        titulo: 'Producto inválido',
        mensaje: 'No se indicó el producto que deseas consultar.',
      });
      return;
    }

    (async () => {
      const resultado = await consultarProducto(slug);
      if (!vigente) return;

      if (resultado.status === 404) {
        setEstado({
          fase: 'estado',
          titulo: 'Producto no encontrado',
          mensaje: 'El producto solicitado no existe o ya no está disponible.',
        });
        return;
      }
      if (!resultado.ok || !resultado.producto) {
        setEstado({
          fase: 'estado',
          titulo: 'No fue posible cargar el producto',
          mensaje: textoSeguro(resultado.mensaje, ERROR_PRODUCTO),
        });
        return;
      }
      setProducto(resultado.producto);
      setEstado({ fase: 'listo' });
    })();

    return () => {
      vigente = false;
    };
  }, []);

  const imagenes = producto && Array.isArray(producto.imagenes) ? producto.imagenes : [];
  const imagenesOrdenadas = [...imagenes].sort((a, b) => {
    if (Boolean(a.principal) !== Boolean(b.principal)) return a.principal ? -1 : 1;
    return Number(a.orden || 0) - Number(b.orden || 0);
  });

  const nombreProducto = textoSeguro(producto?.nombre, 'Producto');
  const unidadesStock = producto ? Number(producto.stock) : Number.NaN;

  return (
    <>
      <SiteHeader>
        <div className="header-actions">
          <EnlaceCarrito unidades={unidades} />
          <a className="back-link" href="/market.html">← Volver al Market</a>
        </div>
      </SiteHeader>

      <main className="page-content">
        <section
          id="status-panel"
          className="status-panel"
          role="status"
          aria-live="polite"
          hidden={estado.fase === 'listo'}
        >
          <p className="eyebrow">Horus Market</p>
          <h1 id="status-title">
            {estado.fase === 'cargando'
              ? 'Cargando producto…'
              : (estado.fase === 'estado' ? estado.titulo : '')}
          </h1>
          <p id="status-message">
            {estado.fase === 'cargando'
              ? 'Estamos obteniendo la información del producto.'
              : (estado.fase === 'estado' ? estado.mensaje : '')}
          </p>
        </section>

        <article id="product-detail" className="product-detail" hidden={estado.fase !== 'listo'}>
          {estado.fase === 'listo' && producto ? (
            <>
              <div className="product-media">
                <GaleriaProducto imagenes={imagenesOrdenadas} nombreProducto={nombreProducto} />
              </div>

              <div className="product-summary">
                <p className="product-category">
                  {textoSeguro(producto.categoria?.nombre, 'Sin categoría')}
                </p>
                <div className="product-heading-row">
                  <h1 className="product-name">{nombreProducto}</h1>
                  {producto.destacado ? <span className="featured-badge">Destacado</span> : null}
                </div>
                <p className="product-price">{formatearPrecio(producto.precio)}</p>
                <p className="short-description">
                  {textoSeguro(producto.descripcion_corta, 'Sin descripción disponible.')}
                </p>
                <div className="info-list">
                  <DatoProducto
                    nombre="Stock"
                    valor={
                      producto.controla_stock === false
                        ? 'Disponible'
                        : (Number.isFinite(unidadesStock) ? `${unidadesStock} unidades` : 'No disponible')
                    }
                  />
                  <DatoProducto nombre="SKU" valor={textoSeguro(producto.sku, 'No disponible')} />
                </div>
                <ControlesCompra producto={producto} />
              </div>

              <section className="product-description-section">
                <h2 className="section-title">Descripción del producto</h2>
                <p className="full-description">
                  {textoSeguro(
                    producto.descripcion,
                    textoSeguro(producto.descripcion_corta, 'Sin descripción disponible.'),
                  )}
                </p>
              </section>
            </>
          ) : null}
        </article>
      </main>

      <SiteFooter />
    </>
  );
}
