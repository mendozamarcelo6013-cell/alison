import { useEffect, useRef, useState, type FormEvent } from 'react';
import { crearPedido } from '../api/pedidos';
import { obtenerConfiguracionPago, iniciarCheckoutPago } from '../api/pagos';
import { consultarProducto } from '../api/productos';
import { mensajeError, ERROR_PEDIDO } from '../api/client';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { useCart } from '../state/CartContext';
import { leerCarrito } from '../state/cart';
import { precioNumero, precioTexto, textoSeguro } from '../utils/format';
import { irA } from '../utils/navigation';
import type { PayloadPedido, PedidoCreado, ProductoConCantidad } from '../types';
import '../../../public/css/market-shared.css';
import '../../../public/css/market-checkout.css';

const CLAVE_ULTIMO_PEDIDO = 'horus_market_last_order';
const MENSAJE_STOCK = 'Uno o más productos ya no están disponibles. Regresa al carrito para actualizarlo.';

type FaseCheckout = 'cargando' | 'vacio' | 'error' | 'listo' | 'exito';

async function obtenerProductoCheckout(
  item: { slug: string; cantidad: number },
): Promise<ProductoConCantidad> {
  const consulta = await consultarProducto(item.slug);
  if (!consulta.ok || !consulta.producto) throw new Error(MENSAJE_STOCK);

  const producto = consulta.producto;
  const stock = Number.parseInt(String(producto.stock), 10) || 0;
  if (producto.controla_stock !== false && (stock <= 0 || item.cantidad > stock)) {
    throw new Error(
      `La cantidad seleccionada ya no está disponible para ${producto.nombre}. Regresa al carrito para actualizarlo.`,
    );
  }
  return { ...producto, cantidad: item.cantidad };
}

export function CheckoutPage() {
  const { vaciar } = useCart();
  const formularioRef = useRef<HTMLFormElement>(null);

  const [fase, setFase] = useState<FaseCheckout>('cargando');
  const [productosValidados, setProductosValidados] = useState<ProductoConCantidad[]>([]);
  const [requiereEntrega, setRequiereEntrega] = useState(false);
  const [mensajeErrorEstado, setMensajeError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [pedidoCreado, setPedidoCreado] = useState<PedidoCreado | null>(null);
  const [pagoHabilitado, setPagoHabilitado] = useState(false);
  const [procesandoPago, setProcesandoPago] = useState(false);

  useEffect(() => {
    let vigente = true;

    const cargar = async () => {
      const carrito = leerCarrito();
      if (carrito.length === 0) {
        if (vigente) setFase('vacio');
        return;
      }

      try {
        const validados = await Promise.all(carrito.map(obtenerProductoCheckout));
        if (!vigente) return;
        setProductosValidados(validados);
        setRequiereEntrega(validados.some((producto) => producto.tipo === 'fisico'));
        setFase('listo');
      } catch (error) {
        if (!vigente) return;
        setMensajeError(mensajeError(error, 'No fue posible validar el carrito.'));
        setFase('error');
      }
    };

    void cargar();
    return () => {
      vigente = false;
    };
  }, []);

  const registrarPedido = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setMensajeError('');

    const formulario = formularioRef.current;
    if (!formulario || !formulario.reportValidity()) return;

    const datos = new FormData(formulario);
    const valor = (nombre: string) => String(datos.get(nombre) ?? '').trim();

    const payload: PayloadPedido = {
      email: valor('email'),
      destinatario: valor('destinatario'),
      telefono: valor('telefono'),
      ...(requiereEntrega
        ? {
          direccion: {
            departamento: valor('departamento'),
            provincia: valor('provincia'),
            distrito: valor('distrito'),
            direccion_linea1: valor('direccion_linea1'),
            referencia: valor('referencia'),
          },
        }
        : {}),
      notas: valor('notas'),
      items: productosValidados.map(({ slug, cantidad }) => ({ slug, cantidad })),
    };

    setEnviando(true);
    try {
      const respuesta = await crearPedido(payload);
      const pedido = respuesta.pedido;

      setPedidoCreado(pedido);
      vaciar();
      sessionStorage.setItem(CLAVE_ULTIMO_PEDIDO, JSON.stringify(pedido));
      setFase('exito');
      setMensajeError('');

      try {
        const configuracion = await obtenerConfiguracionPago();
        if (configuracion.ok && configuracion.habilitada === true) setPagoHabilitado(true);
      } catch {
        // El pedido queda registrado aunque la pasarela aún no esté disponible.
      }
    } catch (error) {
      setMensajeError(mensajeError(error, ERROR_PEDIDO));
    } finally {
      setEnviando(false);
    }
  };

  const pagarEnLinea = async () => {
    if (!pedidoCreado || !pagoHabilitado || procesandoPago) return;
    setProcesandoPago(true);
    try {
      const checkout = await iniciarCheckoutPago(pedidoCreado.numero_pedido);
      irA(checkout.checkout_url);
    } catch (error) {
      setMensajeError(mensajeError(error, 'No se pudo iniciar el pago en línea.'));
      setProcesandoPago(false);
    }
  };

  const total = productosValidados.reduce(
    (acumulado, producto) => acumulado + precioNumero(producto.precio) * producto.cantidad,
    0,
  );

  return (
    <>
      <SiteHeader>
        <div className="header-actions">
          <a className="back-link header-action-button" href="/market-carrito.html">← Volver al carrito</a>
        </div>
      </SiteHeader>

      <main className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Horus Market</p>
            <h1>Finalizar compra</h1>
            <p>Completa tus datos para registrar el pedido.</p>
          </div>
          <span className="secure-note">Compra segura</span>
        </div>

        <p id="loading-state" className="state-message" role="status" hidden={fase !== 'cargando'}>
          Validando tu carrito…
        </p>
        <section id="error-state" className="state-message error-state" role="alert" hidden={!mensajeErrorEstado}>
          {mensajeErrorEstado}
        </section>

        <section id="empty-state" className="empty-state" hidden={fase !== 'vacio'}>
          <h2>Tu carrito está vacío</h2>
          <p>Agrega productos al carrito antes de finalizar la compra.</p>
          <a className="button-primary" href="/market.html">Ir al catálogo</a>
        </section>

        <section id="checkout-content" className="checkout-layout" hidden={fase !== 'listo'}>
          <form id="checkout-form" className="checkout-form" noValidate ref={formularioRef} onSubmit={registrarPedido}>
            <section className="form-card">
              <div className="form-card-heading">
                <p className="eyebrow">Paso 1</p>
                <h2>Datos de contacto</h2>
              </div>
              <div className="form-grid">
                <label className="field field-full">
                  Correo electrónico
                  <input id="email" name="email" type="email" autoComplete="email" required />
                </label>
                <label className="field">
                  Nombre y apellidos
                  <input id="destinatario" name="destinatario" type="text" autoComplete="name" required />
                </label>
                <label className="field">
                  Teléfono
                  <input id="telefono" name="telefono" type="tel" autoComplete="tel" required />
                </label>
              </div>
            </section>

            <section id="delivery-section" className="form-card" hidden={!requiereEntrega}>
              <div className="form-card-heading">
                <p className="eyebrow">Paso 2</p>
                <h2>Dirección de entrega</h2>
                <p className="form-hint">La necesitamos porque tu pedido incluye productos físicos.</p>
              </div>
              <div className="form-grid">
                <label className="field">
                  Departamento
                  <input id="departamento" name="departamento" type="text" autoComplete="address-level1" required={requiereEntrega} />
                </label>
                <label className="field">
                  Provincia
                  <input id="provincia" name="provincia" type="text" autoComplete="address-level2" required={requiereEntrega} />
                </label>
                <label className="field">
                  Distrito
                  <input id="distrito" name="distrito" type="text" required={requiereEntrega} />
                </label>
                <label className="field field-full">
                  Dirección
                  <input id="direccion-linea1" name="direccion_linea1" type="text" autoComplete="street-address" required={requiereEntrega} />
                </label>
                <label className="field field-full">
                  Referencia <span>(opcional)</span>
                  <textarea id="referencia" name="referencia" rows={3} />
                </label>
              </div>
            </section>

            <section className="form-card">
              <div className="form-card-heading">
                <p className="eyebrow">Paso 3</p>
                <h2>Confirmación</h2>
              </div>
              <label className="field field-full">
                Notas para el pedido <span>(opcional)</span>
                <textarea
                  id="notas"
                  name="notas"
                  rows={3}
                  placeholder="Indica alguna consideración para tu pedido."
                />
              </label>
              <label className="terms-check">
                <input id="terms" name="terms" type="checkbox" required />
                <span>He revisado los datos de mi pedido y acepto continuar con el proceso de pago.</span>
              </label>
              <button id="submit-order" className="button-primary submit-order" type="submit" disabled={enviando}>
                {enviando ? 'Registrando pedido…' : 'Registrar pedido y continuar'}
              </button>
              <p className="payment-disclaimer">
                Al registrar el pedido no se solicitarán datos de tarjeta en esta página. El pago en línea se
                conectará mediante una pasarela externa segura.
              </p>
            </section>
          </form>

          <aside className="summary-card" aria-label="Resumen del pedido">
            <p className="eyebrow">Resumen</p>
            <h2>Tu compra</h2>
            <div id="order-items" className="order-items">
              {productosValidados.map((producto) => (
                <div className="order-item" key={producto.slug}>
                  <div>
                    <span className="order-item-name">{textoSeguro(producto.nombre, 'Producto')}</span>
                    <span className="order-item-qty">Cantidad: {producto.cantidad}</span>
                  </div>
                  <strong className="order-item-price">
                    {precioTexto(precioNumero(producto.precio) * producto.cantidad)}
                  </strong>
                </div>
              ))}
            </div>
            <div className="summary-line total-line">
              <span>Total</span>
              <strong id="order-total">{precioTexto(total)}</strong>
            </div>
            <p className="validation-note">El monto y la disponibilidad se validan nuevamente antes de crear el pedido.</p>
          </aside>
        </section>

        <section id="success-state" className="success-state" hidden={fase !== 'exito'} aria-live="polite">
          <p className="eyebrow">Pedido registrado</p>
          <h2>Gracias por tu compra</h2>
          <p id="success-message">
            {pedidoCreado
              ? `Tu pedido ${pedidoCreado.numero_pedido} fue registrado por ${precioTexto(pedidoCreado.total)}. El siguiente paso será completar el pago en línea.`
              : ''}
          </p>
          <div className="payment-ready-card">
            <h3>Pago en línea</h3>
            <p>
              La pasarela se conectará en este punto mediante una redirección segura del proveedor. No se
              almacenarán datos de tarjeta en Horus Market.
            </p>
            <button
              id="payment-button"
              type="button"
              className="button-primary"
              disabled={!pagoHabilitado || procesandoPago}
              onClick={pagarEnLinea}
            >
              {procesandoPago
                ? 'Redirigiendo al pago…'
                : (pagoHabilitado ? 'Pagar en línea' : 'Pagar en línea (por configurar)')}
            </button>
          </div>
          <a className="button-secondary" href="/market.html">Volver al catálogo</a>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
