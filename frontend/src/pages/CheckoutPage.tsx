import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { crearPedido, consultarEstadoPedido } from '../api/pedidos';
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
import { TIENDA } from '../config/tienda';

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
  const [metodoEntrega, setMetodoEntrega] = useState<'envio_domicilio' | 'recojo_tienda'>('envio_domicilio');
  const [telefonoConsulta, setTelefonoConsulta] = useState('');
  const [estadoConsultado, setEstadoConsultado] = useState('');
  const [consultandoEstado, setConsultandoEstado] = useState(false);
  const [tipoComprobante, setTipoComprobante] = useState<'boleta' | 'factura'>('boleta');
  const [datosCliente, setDatosCliente] = useState<{ nombre: string; email: string; telefono: string } | null>(null);

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
      tipo_comprobante: tipoComprobante,
      ...(tipoComprobante === 'factura' ? {
        ruc_factura: valor('ruc_factura'),
        razon_social_factura: valor('razon_social_factura'),
        direccion_factura: valor('direccion_factura'),
      } : {}),
      metodo_entrega: requiereEntrega ? metodoEntrega : 'envio_domicilio',
      ...(requiereEntrega && metodoEntrega === 'envio_domicilio'
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
      setDatosCliente({ nombre: payload.destinatario, email: payload.email, telefono: payload.telefono });
      setTelefonoConsulta(payload.telefono);
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

  const consultarEstado = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!pedidoCreado || !telefonoConsulta.trim()) return;
    setConsultandoEstado(true);
    setEstadoConsultado('');
    try {
      const respuesta = await consultarEstadoPedido(pedidoCreado.numero_pedido, telefonoConsulta.trim());
      setEstadoConsultado(respuesta.etiqueta_estado);
    } catch (error) {
      setEstadoConsultado(mensajeError(error, 'No se pudo consultar el estado del pedido.'));
    } finally {
      setConsultandoEstado(false);
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

  const descargarComprobante = () => window.print();

  return (
    <>
      <SiteHeader>
        <div className="header-actions">
          <Link className="back-link header-action-button" to="/market/carrito">← Volver al carrito</Link>
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
          <Link className="button-primary" to="/market">Ir al catálogo</Link>
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
                  {metodoEntrega === 'recojo_tienda' ? 'Nombre de quien recogerá' : 'Nombre y apellidos'}
                  <input id="destinatario" name="destinatario" type="text" autoComplete="name" required />
                </label>
                <label className="field">
                  {metodoEntrega === 'recojo_tienda' ? 'Celular de quien recogerá' : 'Teléfono'}
                  <input id="telefono" name="telefono" type="tel" autoComplete="tel" required />
                </label>
              </div>
            </section>

            <section id="delivery-section" className="form-card" hidden={!requiereEntrega}>
              <div className="form-card-heading">
                <p className="eyebrow">Paso 2</p>
                <h2>Método de entrega</h2>
                <p className="form-hint">Elige cómo quieres recibir tu pedido.</p>
              </div>
              <div className="delivery-options" role="radiogroup" aria-label="Método de entrega">
                <label className={`delivery-option${metodoEntrega === 'envio_domicilio' ? ' selected' : ''}`}>
                  <input type="radio" name="metodo_entrega" value="envio_domicilio" checked={metodoEntrega === 'envio_domicilio'} onChange={() => setMetodoEntrega('envio_domicilio')} />
                  <span><strong>Envío a domicilio</strong><small>Ingresa la dirección donde recibirás el pedido.</small></span>
                </label>
                <label className={`delivery-option${metodoEntrega === 'recojo_tienda' ? ' selected' : ''}`}>
                  <input type="radio" name="metodo_entrega" value="recojo_tienda" checked={metodoEntrega === 'recojo_tienda'} onChange={() => setMetodoEntrega('recojo_tienda')} />
                  <span><strong>Recojo en tienda</strong><small>Gratis · S/ 0.00</small></span>
                </label>
              </div>
              {metodoEntrega === 'envio_domicilio' ? <>
              <div className="form-grid delivery-address-fields">
                <p className="form-hint field-full">La necesitamos porque tu pedido incluye productos físicos.</p>
                <label className="field">
                  Departamento
                  <input id="departamento" name="departamento" type="text" autoComplete="address-level1" required={requiereEntrega && metodoEntrega === 'envio_domicilio'} disabled={metodoEntrega !== 'envio_domicilio'} />
                </label>
                <label className="field">
                  Provincia
                  <input id="provincia" name="provincia" type="text" autoComplete="address-level2" required={requiereEntrega && metodoEntrega === 'envio_domicilio'} disabled={metodoEntrega !== 'envio_domicilio'} />
                </label>
                <label className="field">
                  Distrito
                  <input id="distrito" name="distrito" type="text" required={requiereEntrega && metodoEntrega === 'envio_domicilio'} disabled={metodoEntrega !== 'envio_domicilio'} />
                </label>
                <label className="field field-full">
                  Dirección
                  <input id="direccion-linea1" name="direccion_linea1" type="text" autoComplete="street-address" required={requiereEntrega && metodoEntrega === 'envio_domicilio'} disabled={metodoEntrega !== 'envio_domicilio'} />
                </label>
                <label className="field field-full">
                  Referencia <span>(opcional)</span>
                  <textarea id="referencia" name="referencia" rows={3} disabled={metodoEntrega !== 'envio_domicilio'} />
                </label>
              </div>
              </> : <div className="pickup-store-card">
                <h3>{TIENDA.nombre}</h3>
                <p><strong>Dirección:</strong> {TIENDA.direccion}</p>
                <p><strong>Referencia:</strong> {TIENDA.referencia || 'Por confirmar'}</p>
                <p><strong>Horario de atención:</strong> {TIENDA.horario || 'Por confirmar'}</p>
                <a href={TIENDA.mapsUrl} target="_blank" rel="noreferrer">Ver ubicación en Google Maps ↗</a>
                <p className="pickup-cost"><strong>Costo de recojo: S/ 0.00</strong></p>
              </div>}
            </section>

            <section className="form-card">
              <div className="form-card-heading">
                <p className="eyebrow">Paso 3</p>
                <h2>Comprobante</h2>
                <p className="form-hint">Selecciona el tipo de comprobante que necesitas.</p>
              </div>
              <div className="delivery-options" role="radiogroup" aria-label="Tipo de comprobante">
                <label className={`delivery-option${tipoComprobante === 'boleta' ? ' selected' : ''}`}>
                  <input type="radio" name="tipo_comprobante" value="boleta" checked={tipoComprobante === 'boleta'} onChange={() => setTipoComprobante('boleta')} />
                  <span><strong>Boleta</strong><small>Comprobante para consumidor final.</small></span>
                </label>
                <label className={`delivery-option${tipoComprobante === 'factura' ? ' selected' : ''}`}>
                  <input type="radio" name="tipo_comprobante" value="factura" checked={tipoComprobante === 'factura'} onChange={() => setTipoComprobante('factura')} />
                  <span><strong>Factura</strong><small>Requiere RUC y datos fiscales.</small></span>
                </label>
              </div>
              {tipoComprobante === 'factura' ? <div className="form-grid">
                <label className="field">
                  RUC
                  <input name="ruc_factura" type="text" inputMode="numeric" autoComplete="off" maxLength={11} pattern="[0-9]{11}" title="Ingresa los 11 dígitos del RUC" required />
                </label>
                <label className="field">
                  Razón social
                  <input name="razon_social_factura" type="text" maxLength={180} required />
                </label>
                <label className="field field-full">
                  Dirección fiscal
                  <input name="direccion_factura" type="text" maxLength={255} required />
                </label>
              </div> : null}
            </section>

            <section className="form-card">
              <div className="form-card-heading">
                <p className="eyebrow">Paso 4</p>
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
          {pedidoCreado ? <article id="receipt-print" className="order-receipt">
            <header className="receipt-heading">
              <p className="eyebrow">HORUS GROUP SRL</p>
              <h3>{pedidoCreado.tipo_comprobante === 'factura' ? 'Factura solicitada' : 'Boleta solicitada'}</h3>
              <p>Pedido {pedidoCreado.numero_pedido}</p>
              <p>{new Date(pedidoCreado.fecha_creacion).toLocaleString('es-PE')}</p>
            </header>
            <div className="receipt-details">
              <p><strong>Cliente:</strong> {pedidoCreado.tipo_comprobante === 'factura' ? pedidoCreado.razon_social_factura : datosCliente?.nombre}</p>
              {pedidoCreado.tipo_comprobante === 'factura' ? <>
                <p><strong>RUC:</strong> {pedidoCreado.ruc_factura}</p>
                <p><strong>Dirección fiscal:</strong> {pedidoCreado.direccion_factura}</p>
              </> : null}
              <p><strong>Correo:</strong> {datosCliente?.email}</p>
              <p><strong>Celular:</strong> {datosCliente?.telefono}</p>
              <p><strong>Entrega:</strong> {pedidoCreado.metodo_entrega === 'recojo_tienda' ? 'Recojo en tienda' : 'Envío a domicilio'}</p>
              {pedidoCreado.metodo_entrega === 'recojo_tienda' ? <p><strong>Dirección de recojo:</strong> {pedidoCreado.direccion_entrega?.direccion_linea1 || TIENDA.direccion}</p> : null}
              {pedidoCreado.metodo_entrega === 'envio_domicilio' && pedidoCreado.direccion_entrega && 'departamento' in pedidoCreado.direccion_entrega ? <p><strong>Dirección de entrega:</strong> {[pedidoCreado.direccion_entrega.direccion_linea1, pedidoCreado.direccion_entrega.distrito, pedidoCreado.direccion_entrega.provincia, pedidoCreado.direccion_entrega.departamento].filter(Boolean).join(', ')}</p> : null}
              <p><strong>Estado del pago:</strong> {pedidoCreado.estado === 'pagado' ? 'Pagado' : 'Pendiente de pago'}</p>
            </div>
            <div className="receipt-items">
              <div className="receipt-row receipt-row-head"><span>Producto</span><span>Cant.</span><span>Importe</span></div>
              {productosValidados.map((producto) => <div className="receipt-row" key={producto.slug}>
                <span>{textoSeguro(producto.nombre, 'Producto')}</span><span>{producto.cantidad}</span><span>{precioTexto(precioNumero(producto.precio) * producto.cantidad)}</span>
              </div>)}
              <div className="receipt-total"><span>Total</span><strong>{precioTexto(precioNumero(pedidoCreado.total))}</strong></div>
            </div>
            <p className="receipt-payment-note">{pedidoCreado.estado === 'pagado' ? 'Pago confirmado.' : 'Este comprobante confirma el pedido. El pago aún no está confirmado y no acredita un pago realizado.'}</p>
          </article> : null}
          {pedidoCreado ? <div className="receipt-download">
            <button className="button-primary" type="button" onClick={descargarComprobante}>Descargar comprobante</button>
            <small>En la ventana que se abre, elige “Guardar como PDF”.</small>
          </div> : null}
          {pedidoCreado?.metodo_entrega === 'recojo_tienda' ? <div className="pickup-confirmation">
            <h3>Recojo en tienda</h3>
            <p><strong>{TIENDA.nombre}</strong><br />{pedidoCreado.direccion_entrega?.direccion_linea1 || TIENDA.direccion}</p>
            <p>Estado: {pedidoCreado.estado_recojo === 'en_preparacion' ? 'En preparación' : pedidoCreado.estado_recojo === 'listo_para_recoger' ? 'Listo para recoger' : pedidoCreado.estado_recojo === 'entregado' ? 'Entregado' : 'Pendiente'}</p>
            <a href={TIENDA.mapsUrl} target="_blank" rel="noreferrer">Ver ubicación en Google Maps ↗</a>
          </div> : null}
          {pedidoCreado ? <form className="order-status-form" onSubmit={consultarEstado}>
            <label className="field">Consultar estado del pedido
              <input type="tel" value={telefonoConsulta} onChange={(evento) => setTelefonoConsulta(evento.target.value)} required aria-label="Celular registrado en el pedido" />
            </label>
            <button className="button-secondary" type="submit" disabled={consultandoEstado}>{consultandoEstado ? 'Consultando…' : 'Consultar estado'}</button>
            {estadoConsultado ? <p role="status">{estadoConsultado}</p> : null}
          </form> : null}
          <p><Link to="/market/seguimiento">Consultar este pedido más adelante</Link></p>
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
          <Link className="button-secondary" to="/market">Volver al catálogo</Link>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
