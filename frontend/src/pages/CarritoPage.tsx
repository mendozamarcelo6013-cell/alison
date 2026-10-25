import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { consultarProducto, detalleEnCache } from '../api/productos';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { ProductoImagen } from '../components/ProductoImagen';
import { useCart } from '../state/CartContext';
import { leerCarrito } from '../state/cart';
import { precioNumero, precioTexto, textoSeguro } from '../utils/format';
import type { ItemCarrito as ItemAlmacenado, ProductoDetalle } from '../types';

type Registro =
  | { item: ItemAlmacenado; estado: 'no-disponible' | 'error'; producto?: undefined; stock?: undefined; ajustadoA?: undefined }
  | {
    item: ItemAlmacenado;
    estado: 'disponible' | 'agotado';
    producto: ProductoDetalle;
    stock: number;
    /** Stock al que se redujo la cantidad guardada, si excedía la existencia. */
    ajustadoA?: number;
  };

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
    const excedeStock = stock > 0 && item.cantidad > stock;
    const itemActualizado = excedeStock ? actualizar(item.slug, stock, stock) : item;

    return {
      item: itemActualizado || item,
      producto,
      stock,
      ajustadoA: excedeStock && controlaStock ? stock : undefined,
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
            ancho={224}
            alto={224}
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
            {registro.ajustadoA !== undefined ? (
              <p className="item-notice" role="status">
                Ajustamos la cantidad a {registro.ajustadoA} unidad{registro.ajustadoA === 1 ? '' : 'es'}, que es el stock disponible.
              </p>
            ) : null}
            {registro.estado === 'agotado' ? (
              <p className="item-notice item-notice-error" role="alert">
                Este producto se agotó. Elimínalo para continuar con la compra.
              </p>
            ) : null}
            {registro.estado === 'disponible' && producto.controla_stock !== false
              && registro.item.cantidad >= registro.stock ? (
                <p className="item-limit">Alcanzaste el máximo disponible.</p>
              ) : null}
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
            <div className="quantity-control" role="group" aria-label={`Cantidad de ${textoSeguro(producto.nombre, 'producto')}`}>
              <button
                type="button"
                aria-label="Disminuir cantidad"
                disabled={registro.estado === 'agotado' || registro.item.cantidad <= 1}
                onClick={() => onCambiar(registro, registro.item.cantidad - 1)}
              >
                −
              </button>
              <span className="quantity-value" aria-live="polite">{registro.item.cantidad}</span>
              <button
                type="button"
                aria-label="Aumentar cantidad"
                disabled={registro.estado === 'agotado' || registro.item.cantidad >= registro.stock}
                onClick={() => onCambiar(registro, registro.item.cantidad + 1)}
              >
                +
              </button>
            </div>
          </>
        ) : null}
        <button
          type="button"
          className="remove-button"
          aria-label={`Eliminar ${textoSeguro(producto?.nombre, 'producto no disponible')} del carrito`}
          onClick={() => onEliminar(registro.item.slug)}
        >
          Eliminar
        </button>
      </div>
    </article>
  );
}

/**
 * Registros provisionales con lo que la vista ya conoce de cada producto. Sólo
 * sirven para no dejar la pantalla en blanco: el botón de compra permanece
 * bloqueado hasta que el backend confirma precio y stock.
 */
function registrosDesdeCache(carrito: ItemAlmacenado[]): Registro[] | null {
  const registros: Registro[] = [];
  for (const item of carrito) {
    const enCache = detalleEnCache(item.slug);
    if (!enCache) return null;
    const producto = enCache.producto;
    const controlaStock = producto.controla_stock !== false;
    const stock = controlaStock ? Math.max(0, Number.parseInt(String(producto.stock), 10) || 0) : 99;
    registros.push({
      item,
      producto,
      stock,
      estado: controlaStock && stock === 0 ? 'agotado' : 'disponible',
    });
  }
  return registros;
}

export function CarritoPage() {
  const { actualizar, eliminar, unidades } = useCart();
  const navegar = useNavigate();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [fase, setFase] = useState<FaseCarrito>('cargando');
  const [validando, setValidando] = useState(true);
  const [errorValidacion, setErrorValidacion] = useState(false);
  const ultimaCarga = useRef(0);

  const cargar = useCallback(async () => {
    const numeroCarga = ultimaCarga.current + 1;
    ultimaCarga.current = numeroCarga;
    setErrorValidacion(false);
    setValidando(true);

    const carrito = leerCarrito();
    if (carrito.length === 0) {
      setRegistros([]);
      setFase('vacio');
      setValidando(false);
      return;
    }

    const provisionales = registrosDesdeCache(carrito);
    if (provisionales) {
      setRegistros(provisionales);
      setFase('listo');
    } else {
      setFase('cargando');
    }

    const resultados = await Promise.all(
      carrito.map((item) => consultarRegistro(item, actualizar)),
    );
    if (numeroCarga !== ultimaCarga.current) return;
    setRegistros(resultados);
    setErrorValidacion(resultados.some((registro) => registro.estado === 'error'));
    setFase('listo');
    setValidando(false);
  }, [actualizar]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiarCantidad = (registro: Registro, cantidad: number) => {
    const actualizado = actualizar(registro.item.slug, cantidad, registro.stock ?? 0);
    if (!actualizado) return;
    setRegistros((previo) => previo.map((elemento) => (
      elemento.item.slug === registro.item.slug
        ? ({ ...elemento, item: actualizado, ajustadoA: undefined } as Registro)
        : elemento
    )));
  };

  // Se actualiza la lista en memoria: volver a consultar toda la red tras cada
  // eliminación hacía parpadear el carrito completo.
  const eliminarItem = (slug: string) => {
    eliminar(slug);
    const restantes = registros.filter((registro) => registro.item.slug !== slug);
    setRegistros(restantes);
    setErrorValidacion(restantes.some((registro) => registro.estado === 'error'));
    if (restantes.length === 0) setFase('vacio');
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
  const checkoutBloqueado = validando || contieneNoDisponible || !hayDisponibles;

  return (
    <>
      <SiteHeader>
        <div className="header-actions">
          <Link className="back-link header-action-button" to="/market">← Seguir comprando</Link>
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
        {fase === 'listo' && validando ? (
          <p className="state-message state-message-inline" role="status">
            Verificando precio y stock actualizados…
          </p>
        ) : null}
        <section id="error-state" className="state-message error-state" role="alert" hidden={!errorValidacion}>
          <span>Algunos productos no pudieron validarse. Puedes eliminarlos o intentar nuevamente.</span>
          <button type="button" className="button-secondary" onClick={() => void cargar()}>Reintentar</button>
        </section>
        <section id="empty-state" className="empty-state" hidden={fase !== 'vacio'}>
          <h2>Tu carrito está vacío</h2>
          <p>Agrega productos desde el catálogo para verlos aquí.</p>
          <Link to="/market" className="button-primary">Volver al Market</Link>
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
              title={checkoutBloqueado && !validando ? 'Elimina o actualiza los productos no disponibles para continuar.' : ''}
              onClick={() => navegar('/market/checkout')}
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
