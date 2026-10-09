import { useCallback, useEffect, useState } from 'react';
import { consultarProducto } from '../api/productos';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { ProductoImagen } from '../components/ProductoImagen';
import { useCart } from '../state/CartContext';
import { leerCarrito } from '../state/cart';
import { precioNumero, precioTexto, textoSeguro } from '../utils/format';
import { irA } from '../utils/navigation';
import type { ItemCarrito as ItemAlmacenado, ProductoDetalle } from '../types';
import '../../../public/css/market-shared.css';
import '../../../public/css/market-carrito.css';

type Registro =
  | { item: ItemAlmacenado; estado: 'no-disponible' | 'error'; producto?: undefined; stock?: undefined }
  | { item: ItemAlmacenado; estado: 'disponible' | 'agotado'; producto: ProductoDetalle; stock: number };

type FaseCarrito = 'cargando' | 'vacio' | 'listo';

async function consultarRegistro(
  item: ItemAlmacenado,
  actualizar: (slug: string, cantidad: number, stock: number) => ItemAlmacenado | null,
): Promise<Registro> {
  try {
    const consulta = await consultarProducto(item.slug);

    if (consulta.status === 404) return { item, estado: 'no-disponible' };
    if (!consulta.ok || !consulta.producto) return { item, estado: 'error' };

    const producto = consulta.producto;
    const controlaStock = producto.controla_stock !== false;
    const stock = controlaStock
      ? Math.max(0, Number.parseInt(String(producto.stock), 10) || 0)
      : 99;
    const itemActualizado = stock > 0 && item.cantidad > stock
      ? actualizar(item.slug, stock, stock)
      : item;

    return {
      item: itemActualizado || item,
      producto,
      stock,
      estado: controlaStock && stock === 0 ? 'agotado' : 'disponible',
    };
  } catch {
    return { item, estado: 'error' };
  }
}

interface PropsElemento {
  registro: Registro;
  onCambiar: (registro: Registro, cantidad: number) => void;
  onEliminar: (slug: string) => void;
}

function ElementoCarrito({ registro, onCambiar, onEliminar }: PropsElemento) {
  const { producto } = registro;

  return (
    <article className="cart-item">
      {!producto ? (
        <>
          <div className="item-placeholder">Imagen no disponible</div>
          <div>
            <h2 className="item-name">Producto no disponible</h2>
            <p className="availability unavailable">
              {registro.estado === 'error'
                ? 'No fue posible validar este producto ahora.'
                : 'Este producto ya no existe o está inactivo.'}
            </p>
          </div>
        </>
      ) : (
        <>
          <ProductoImagen
            url={producto.imagenes.find((imagen) => imagen.principal)?.url || producto.imagenes[0]?.url}
            alt={textoSeguro(
              (producto.imagenes.find((imagen) => imagen.principal) || producto.imagenes[0])?.texto_alternativo,
              textoSeguro(producto.nombre, 'Producto'),
            )}
            className="item-image"
            placeholderClassName="item-placeholder"
          />
          <div>
            <span className="item-category">
              {textoSeguro(producto.categoria?.nombre, 'Sin categoría')}
            </span>
            <h2 className="item-name">{textoSeguro(producto.nombre, 'Producto')}</h2>
            <span className="item-sku">SKU: {textoSeguro(producto.sku, 'No disponible')}</span>
            <span className="item-stock">
              {producto.controla_stock === false
                ? 'Disponibilidad: inmediata'
                : `Stock disponible: ${registro.stock} unidades`}
            </span>
            <p className={`availability${registro.estado === 'agotado' ? ' unavailable' : ''}`}>
              {registro.estado === 'agotado' ? 'Agotado' : 'Disponible'}
            </p>
          </div>
        </>
      )}

      <div className="item-actions">
        {producto ? (
          <>
            <span className="item-price">Unitario: {precioTexto(producto.precio)}</span>
            <strong className="item-subtotal">
              Subtotal: {precioTexto(precioNumero(producto.precio) * registro.item.cantidad)}
            </strong>
            <div className="quantity-control">
              <button
                type="button"
                disabled={registro.estado === 'agotado' || registro.item.cantidad <= 1}
                onClick={() => onCambiar(registro, registro.item.cantidad - 1)}
              >
                −
              </button>
              <span className="quantity-value">{registro.item.cantidad}</span>
              <button
                type="button"
                disabled={registro.estado === 'agotado' || registro.item.cantidad >= registro.stock}
                onClick={() => onCambiar(registro, registro.item.cantidad + 1)}
              >
                +
              </button>
            </div>
          </>
        ) : null}
        <button type="button" className="remove-button" onClick={() => onEliminar(registro.item.slug)}>
          Eliminar
        </button>
      </div>
    </article>
  );
}

export function CarritoPage() {
  const { actualizar, eliminar, unidades } = useCart();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [fase, setFase] = useState<FaseCarrito>('cargando');
  const [errorValidacion, setErrorValidacion] = useState(false);

  const cargar = useCallback(async () => {
    setFase('cargando');
    setErrorValidacion(false);

    const carrito = leerCarrito();
    if (carrito.length === 0) {
      setRegistros([]);
      setFase('vacio');
      return;
    }

    const resultados = await Promise.all(
      carrito.map((item) => consultarRegistro(item, actualizar)),
    );
    setRegistros(resultados);
    setErrorValidacion(resultados.some((registro) => registro.estado === 'error'));
    setFase('listo');
  }, [actualizar]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiarCantidad = (registro: Registro, cantidad: number) => {
    const actualizado = actualizar(registro.item.slug, cantidad, registro.stock ?? 0);
    if (!actualizado) return;
    setRegistros((previo) => previo.map((elemento) => (
      elemento.item.slug === registro.item.slug
        ? ({ ...elemento, item: actualizado } as Registro)
        : elemento
    )));
  };

  const eliminarItem = (slug: string) => {
    eliminar(slug);
    void cargar();
  };

  const subtotal = registros
    .filter((registro) => registro.producto && registro.estado === 'disponible')
    .reduce((total, registro) => total + precioNumero(registro.producto?.precio) * registro.item.cantidad, 0);

  const contieneNoDisponible = registros.some(
    (registro) => !registro.producto || registro.estado !== 'disponible',
  );
  const hayDisponibles = registros.some(
    (registro) => registro.producto && registro.estado === 'disponible',
  );
  const checkoutBloqueado = contieneNoDisponible || !hayDisponibles;

  return (
    <>
      <SiteHeader>
        <div className="header-actions">
          <a className="back-link header-action-button" href="/market.html">← Seguir comprando</a>
        </div>
      </SiteHeader>

      <main className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Horus Market</p>
            <h1>Tu carrito</h1>
          </div>
          <span className="cart-count">
            Unidades: <span data-cart-count>{unidades}</span>
          </span>
        </div>

        <p id="loading-state" className="state-message" role="status" hidden={fase !== 'cargando'}>
          Actualizando productos del carrito…
        </p>
        <section id="error-state" className="state-message error-state" role="alert" hidden={!errorValidacion}>
          Algunos productos no pudieron validarse. Puedes eliminarlos o intentar nuevamente.
        </section>
        <section id="empty-state" className="empty-state" hidden={fase !== 'vacio'}>
          <h2>Tu carrito está vacío</h2>
          <p>Agrega productos desde el catálogo para verlos aquí.</p>
          <a href="/market.html" className="button-primary">Volver al Market</a>
        </section>

        <section id="cart-content" className="cart-layout" hidden={fase !== 'listo'}>
          <div id="cart-items" className="cart-items">
            {fase === 'listo'
              ? registros.map((registro) => (
                <ElementoCarrito
                  key={registro.item.slug}
                  registro={registro}
                  onCambiar={cambiarCantidad}
                  onEliminar={eliminarItem}
                />
              ))
              : null}
          </div>
          <aside className="summary-card" aria-label="Resumen del carrito">
            <h2>Resumen</h2>
            <div className="summary-line">
              <span>Subtotal</span>
              <strong id="subtotal">{precioTexto(subtotal)}</strong>
            </div>
            <p className="validation-note">El precio y stock serán validados nuevamente al finalizar la compra.</p>
            <button
              id="checkout-button"
              type="button"
              className="checkout-button"
              disabled={fase !== 'listo' || checkoutBloqueado}
              title={checkoutBloqueado ? 'Elimina o actualiza los productos no disponibles para continuar.' : ''}
              onClick={() => irA('/market-checkout.html')}
            >
              Finalizar compra
            </button>
          </aside>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
