import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { crearPedido, consultarEstadoPedido } from '../api/pedidos';
import { obtenerConfiguracionPago, iniciarCheckoutPago } from '../api/pagos';
import { consultarProducto, invalidarCacheProductos } from '../api/productos';
import { mensajeError, ERROR_PEDIDO } from '../api/client';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { useCart } from '../state/CartContext';
import { leerCarrito } from '../state/cart';
import { precioNumero, precioTexto, textoSeguro } from '../utils/format';
import { irA } from '../utils/navigation';
import {
  DATOS_CHECKOUT_INICIALES,
  primerCampoConError,
  validarPaso,
  type CampoCheckout,
  type DatosCheckout,
  type ErroresCheckout,
  type PasoCheckout,
} from '../utils/validacionCheckout';
import type { PayloadPedido, PedidoCreado, ProductoConCantidad } from '../types';
import { TIENDA } from '../config/tienda';

const CLAVE_ULTIMO_PEDIDO = 'horus_market_last_order';
const MENSAJE_STOCK = 'Uno o más productos ya no están disponibles. Regresa al carrito para actualizarlo.';

type FaseCheckout = 'cargando' | 'vacio' | 'error' | 'listo' | 'exito';

const TITULO_PASO: Record<PasoCheckout, string> = {
  contacto: 'Datos de contacto',
  entrega: 'Método de entrega',
  comprobante: 'Comprobante',
  confirmacion: 'Confirmación',
};

const ETIQUETA_PASO: Record<PasoCheckout, string> = {
  contacto: 'Contacto',
  entrega: 'Entrega',
  comprobante: 'Comprobante',
  confirmacion: 'Confirmar',
};

const ID_CAMPO: Record<CampoCheckout | 'referencia' | 'notas', string> = {
  email: 'email',
  destinatario: 'destinatario',
  telefono: 'telefono',
  departamento: 'departamento',
  provincia: 'provincia',
  distrito: 'distrito',
  direccion_linea1: 'direccion-linea1',
  referencia: 'referencia',
  ruc_factura: 'ruc-factura',
  razon_social_factura: 'razon-social-factura',
  direccion_factura: 'direccion-factura',
  notas: 'notas',
  terminos: 'terms',
};

/** Holgura bajo el encabezado sticky antes de recolocar el scroll. */
const HOLGURA_ENCABEZADO_PX = 8;

function alturaEncabezado(): number {
  return document.querySelector('.site-header')?.getBoundingClientRect().height ?? 0;
}

async function obtenerProductoCheckout(
  item: { slug: string; cantidad: number },
): Promise<ProductoConCantidad> {
  // Siempre a la red: el checkout nunca decide con datos de la caché de la vista.
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

interface PropsProgreso {
  pasos: PasoCheckout[];
  indiceActual: number;
  onIr: (indice: number) => void;
}

function ProgresoCheckout({ pasos, indiceActual, onIr }: PropsProgreso) {
  return (
    <nav className="stepper" aria-label="Progreso del pedido">
      <ol>
        {pasos.map((paso, indice) => {
          const completado = indice < indiceActual;
          const actual = indice === indiceActual;
          const contenido = (
            <>
              <span className="stepper-marker" aria-hidden="true">{completado ? '✓' : indice + 1}</span>
              <span className="stepper-label">{ETIQUETA_PASO[paso]}</span>
              {completado ? <span className="sr-only"> (completado, volver a editar)</span> : null}
            </>
          );
          return (
            <li
              key={paso}
              className={`stepper-item${completado ? ' is-done' : ''}${actual ? ' is-current' : ''}`}
              aria-current={actual ? 'step' : undefined}
            >
              {completado ? (
                <button type="button" className="stepper-button" onClick={() => onIr(indice)}>{contenido}</button>
              ) : (
                <span className="stepper-button">{contenido}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface PropsCampoTexto {
  campo: CampoCheckout | 'referencia' | 'notas';
  etiqueta: ReactNode;
  valor: string;
  error?: string;
  onCambiar: (campo: CampoCheckout | 'referencia' | 'notas', valor: string) => void;
  tipo?: string;
  autoComplete?: string;
  inputMode?: 'numeric' | 'tel' | 'email' | 'text';
  maxLength?: number;
  completo?: boolean;
  multilinea?: boolean;
  placeholder?: string;
}

function CampoTexto({
  campo, etiqueta, valor, error, onCambiar, tipo = 'text', autoComplete, inputMode,
  maxLength, completo = false, multilinea = false, placeholder,
}: PropsCampoTexto) {
  const id = ID_CAMPO[campo];
  const idError = `${id}-error`;
  const comunes = {
    id,
    name: campo,
    value: valor,
    placeholder,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? idError : undefined,
    onChange: (evento: { target: { value: string } }) => onCambiar(campo, evento.target.value),
  };

  return (
    <div className={`field-group${completo ? ' field-full' : ''}`}>
      <label className="field" htmlFor={id}>
        {etiqueta}
        {multilinea
          ? <textarea {...comunes} rows={3} />
          : <input {...comunes} type={tipo} autoComplete={autoComplete} inputMode={inputMode} maxLength={maxLength} />}
      </label>
      {error ? <p id={idError} className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}

export function CheckoutPage() {
  const { vaciar } = useCart();
  const encabezadoPasoRef = useRef<HTMLHeadingElement>(null);
  const contenedorPasoRef = useRef<HTMLDivElement>(null);
  const envioEnCurso = useRef(false);
  const primerRender = useRef(true);

  const [fase, setFase] = useState<FaseCheckout>('cargando');
  const [productosValidados, setProductosValidados] = useState<ProductoConCantidad[]>([]);
  const [requiereEntrega, setRequiereEntrega] = useState(false);
  const [mensajeErrorEstado, setMensajeError] = useState('');
  const [errorEnvio, setErrorEnvio] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [pedidoCreado, setPedidoCreado] = useState<PedidoCreado | null>(null);
  const [pagoHabilitado, setPagoHabilitado] = useState(false);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [telefonoConsulta, setTelefonoConsulta] = useState('');
  const [estadoConsultado, setEstadoConsultado] = useState('');
  const [consultandoEstado, setConsultandoEstado] = useState(false);
  const [datosCliente, setDatosCliente] = useState<{ nombre: string; email: string; telefono: string } | null>(null);

  const [datos, setDatos] = useState<DatosCheckout>(DATOS_CHECKOUT_INICIALES);
  const [errores, setErrores] = useState<ErroresCheckout>({});
  const [indicePaso, setIndicePaso] = useState(0);
  const [resumenAbierto, setResumenAbierto] = useState(false);

  const pasos = useMemo<PasoCheckout[]>(
    () => (requiereEntrega
      ? ['contacto', 'entrega', 'comprobante', 'confirmacion']
      : ['contacto', 'comprobante', 'confirmacion']),
    [requiereEntrega],
  );
  const paso = pasos[indicePaso] ?? 'contacto';
  const esUltimoPaso = indicePaso === pasos.length - 1;
  const metodoEntrega = requiereEntrega ? datos.metodoEntrega : 'envio_domicilio';

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

  // Al cambiar de paso: el foco pasa al título (lectores de pantalla) y la
  // página sólo se desplaza si el paso quedó tapado por el encabezado sticky.
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    encabezadoPasoRef.current?.focus({ preventScroll: true });
    const contenedor = contenedorPasoRef.current;
    if (contenedor && contenedor.getBoundingClientRect().top < alturaEncabezado() + HOLGURA_ENCABEZADO_PX) {
      contenedor.scrollIntoView?.({ block: 'start', behavior: 'instant' });
    }
  }, [indicePaso]);

  const cambiarCampo = (campo: CampoCheckout | 'referencia' | 'notas', valor: string) => {
    const limpio = campo === 'ruc_factura' ? valor.replace(/\D/g, '') : valor;
    setDatos((previos) => ({ ...previos, [campo]: limpio }));
    setErrores((previos) => {
      if (!(campo in previos)) return previos;
      const { [campo as CampoCheckout]: _quitado, ...restantes } = previos;
      return restantes;
    });
  };

  const enfocarCampo = (campo: CampoCheckout) => {
    document.getElementById(ID_CAMPO[campo])?.focus();
  };

  /** Valida el paso actual; si falla, muestra los errores y enfoca el primero. */
  const pasoEsValido = (): boolean => {
    const encontrados = validarPaso(paso, datos);
    setErrores(encontrados);
    const primero = primerCampoConError(encontrados);
    if (primero) enfocarCampo(primero);
    return primero === null;
  };

  const avanzar = () => {
    if (!pasoEsValido()) return;
    setIndicePaso((actual) => Math.min(actual + 1, pasos.length - 1));
  };

  const retroceder = () => {
    setErrores({});
    setIndicePaso((actual) => Math.max(actual - 1, 0));
  };

  const irAPaso = (indice: number) => {
    if (indice >= indicePaso) return;
    setErrores({});
    setIndicePaso(indice);
  };

  const registrarPedido = async () => {
    if (envioEnCurso.current) return;

    // Antes de enviar se revalida cada paso: así nunca viaja un dato que el
    // usuario modificó y dejó incompleto al volver atrás.
    for (let indice = 0; indice < pasos.length; indice += 1) {
      const errorPaso = validarPaso(pasos[indice], datos);
      const campo = primerCampoConError(errorPaso);
      if (campo) {
        setErrores(errorPaso);
        setIndicePaso(indice);
        window.setTimeout(() => enfocarCampo(campo), 0);
        return;
      }
    }

    setErrorEnvio('');
    const texto = (valor: string) => valor.trim();
    const payload: PayloadPedido = {
      email: texto(datos.email),
      destinatario: texto(datos.destinatario),
      telefono: texto(datos.telefono),
      tipo_comprobante: datos.tipoComprobante,
      ...(datos.tipoComprobante === 'factura' ? {
        ruc_factura: texto(datos.ruc_factura),
        razon_social_factura: texto(datos.razon_social_factura),
        direccion_factura: texto(datos.direccion_factura),
      } : {}),
      metodo_entrega: metodoEntrega,
      ...(requiereEntrega && metodoEntrega === 'envio_domicilio'
        ? {
          direccion: {
            departamento: texto(datos.departamento),
            provincia: texto(datos.provincia),
            distrito: texto(datos.distrito),
            direccion_linea1: texto(datos.direccion_linea1),
            referencia: texto(datos.referencia),
          },
        }
        : {}),
      notas: texto(datos.notas),
      items: productosValidados.map(({ slug, cantidad }) => ({ slug, cantidad })),
    };

    envioEnCurso.current = true;
    setEnviando(true);
    try {
      const respuesta = await crearPedido(payload);
      const pedido = respuesta.pedido;

      setPedidoCreado(pedido);
      setDatosCliente({ nombre: payload.destinatario, email: payload.email, telefono: payload.telefono });
      setTelefonoConsulta(payload.telefono);
      vaciar();
      // El stock cambió con este pedido: lo guardado en la vista ya no es fiable.
      invalidarCacheProductos();
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
      setErrorEnvio(mensajeError(error, ERROR_PEDIDO));
      envioEnCurso.current = false;
    } finally {
      setEnviando(false);
    }
  };

  const alEnviarFormulario = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (esUltimoPaso) void registrarPedido();
    else avanzar();
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

  const campo = (
    nombre: CampoCheckout | 'referencia' | 'notas',
    propiedades: Omit<PropsCampoTexto, 'campo' | 'valor' | 'error' | 'onCambiar'>,
  ) => (
    <CampoTexto
      campo={nombre}
      valor={String(datos[nombre])}
      error={nombre in errores ? errores[nombre as CampoCheckout] : undefined}
      onCambiar={cambiarCampo}
      {...propiedades}
    />
  );

  const direccionEntregaTexto = [datos.direccion_linea1, datos.distrito, datos.provincia, datos.departamento]
    .map((parte) => parte.trim())
    .filter(Boolean)
    .join(', ');

  const numeroPaso = `Paso ${indicePaso + 1} de ${pasos.length}`;

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
          <div className="checkout-main">
            <ProgresoCheckout pasos={pasos} indiceActual={indicePaso} onIr={irAPaso} />
            <form id="checkout-form" className="checkout-form" noValidate onSubmit={alEnviarFormulario}>
              <section className="form-card checkout-step" ref={contenedorPasoRef} aria-labelledby="titulo-paso">
                <div className="form-card-heading">
                  <p className="eyebrow">{numeroPaso}</p>
                  <h2 id="titulo-paso" ref={encabezadoPasoRef} tabIndex={-1}>{TITULO_PASO[paso]}</h2>
                  {paso === 'entrega' ? <p className="form-hint">Elige cómo quieres recibir tu pedido.</p> : null}
                  {paso === 'comprobante' ? <p className="form-hint">Selecciona el tipo de comprobante que necesitas.</p> : null}
                </div>

                {paso === 'contacto' ? (
                  <div className="form-grid">
                    {campo('email', { etiqueta: 'Correo electrónico', tipo: 'email', autoComplete: 'email', inputMode: 'email', completo: true })}
                    {campo('destinatario', {
                      etiqueta: metodoEntrega === 'recojo_tienda' ? 'Nombre de quien recogerá' : 'Nombre y apellidos',
                      autoComplete: 'name',
                    })}
                    {campo('telefono', {
                      etiqueta: metodoEntrega === 'recojo_tienda' ? 'Celular de quien recogerá' : 'Teléfono',
                      tipo: 'tel',
                      autoComplete: 'tel',
                      inputMode: 'tel',
                    })}
                  </div>
                ) : null}

                {paso === 'entrega' ? (
                  <div id="delivery-section">
                    <div className="delivery-options" role="radiogroup" aria-label="Método de entrega">
                      <label className={`delivery-option${datos.metodoEntrega === 'envio_domicilio' ? ' selected' : ''}`}>
                        <input
                          type="radio"
                          name="metodo_entrega"
                          value="envio_domicilio"
                          checked={datos.metodoEntrega === 'envio_domicilio'}
                          onChange={() => setDatos((previos) => ({ ...previos, metodoEntrega: 'envio_domicilio' }))}
                        />
                        <span><strong>Envío a domicilio</strong><small>Ingresa la dirección donde recibirás el pedido.</small></span>
                      </label>
                      <label className={`delivery-option${datos.metodoEntrega === 'recojo_tienda' ? ' selected' : ''}`}>
                        <input
                          type="radio"
                          name="metodo_entrega"
                          value="recojo_tienda"
                          checked={datos.metodoEntrega === 'recojo_tienda'}
                          onChange={() => {
                            setErrores({});
                            setDatos((previos) => ({ ...previos, metodoEntrega: 'recojo_tienda' }));
                          }}
                        />
                        <span><strong>Recojo en tienda</strong><small>Gratis · S/ 0.00</small></span>
                      </label>
                    </div>
                    {datos.metodoEntrega === 'envio_domicilio' ? (
                      <div className="form-grid delivery-address-fields">
                        <p className="form-hint field-full">La necesitamos porque tu pedido incluye productos físicos.</p>
                        {campo('departamento', { etiqueta: 'Departamento', autoComplete: 'address-level1' })}
                        {campo('provincia', { etiqueta: 'Provincia', autoComplete: 'address-level2' })}
                        {campo('distrito', { etiqueta: 'Distrito' })}
                        {campo('direccion_linea1', { etiqueta: 'Dirección', autoComplete: 'street-address', completo: true })}
                        {campo('referencia', { etiqueta: <>Referencia <span>(opcional)</span></>, completo: true, multilinea: true })}
                      </div>
                    ) : (
                      <div className="pickup-store-card">
                        <h3>{TIENDA.nombre}</h3>
                        <p><strong>Dirección:</strong> {TIENDA.direccion}</p>
                        <p><strong>Referencia:</strong> {TIENDA.referencia || 'Por confirmar'}</p>
                        <p><strong>Horario de atención:</strong> {TIENDA.horario || 'Por confirmar'}</p>
                        <a href={TIENDA.mapsUrl} target="_blank" rel="noreferrer">Ver ubicación en Google Maps ↗</a>
                        <p className="pickup-cost"><strong>Costo de recojo: S/ 0.00</strong></p>
                      </div>
                    )}
                  </div>
                ) : null}

                {paso === 'comprobante' ? (
                  <>
                    <div className="delivery-options" role="radiogroup" aria-label="Tipo de comprobante">
                      <label className={`delivery-option${datos.tipoComprobante === 'boleta' ? ' selected' : ''}`}>
                        <input
                          type="radio"
                          name="tipo_comprobante"
                          value="boleta"
                          checked={datos.tipoComprobante === 'boleta'}
                          onChange={() => {
                            setErrores({});
                            setDatos((previos) => ({ ...previos, tipoComprobante: 'boleta' }));
                          }}
                        />
                        <span><strong>Boleta</strong><small>Comprobante para consumidor final.</small></span>
                      </label>
                      <label className={`delivery-option${datos.tipoComprobante === 'factura' ? ' selected' : ''}`}>
                        <input
                          type="radio"
                          name="tipo_comprobante"
                          value="factura"
                          checked={datos.tipoComprobante === 'factura'}
                          onChange={() => setDatos((previos) => ({ ...previos, tipoComprobante: 'factura' }))}
                        />
                        <span><strong>Factura</strong><small>Requiere RUC y datos fiscales.</small></span>
                      </label>
                    </div>
                    {datos.tipoComprobante === 'factura' ? (
                      <div className="form-grid">
                        {campo('ruc_factura', { etiqueta: 'RUC', inputMode: 'numeric', autoComplete: 'off', maxLength: 11 })}
                        {campo('razon_social_factura', { etiqueta: 'Razón social', maxLength: 180 })}
                        {campo('direccion_factura', { etiqueta: 'Dirección fiscal', maxLength: 255, completo: true })}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {paso === 'confirmacion' ? (
                  <>
                    <dl className="review-list">
                      <div className="review-item">
                        <dt>Contacto</dt>
                        <dd>{datos.destinatario.trim()} · {datos.email.trim()} · {datos.telefono.trim()}</dd>
                        <button type="button" className="review-edit" onClick={() => irAPaso(0)}>Editar</button>
                      </div>
                      {requiereEntrega ? (
                        <div className="review-item">
                          <dt>Entrega</dt>
                          <dd>
                            {metodoEntrega === 'recojo_tienda'
                              ? `Recojo en tienda · ${TIENDA.direccion}`
                              : `Envío a domicilio · ${direccionEntregaTexto}`}
                          </dd>
                          <button type="button" className="review-edit" onClick={() => irAPaso(pasos.indexOf('entrega'))}>Editar</button>
                        </div>
                      ) : null}
                      <div className="review-item">
                        <dt>Comprobante</dt>
                        <dd>
                          {datos.tipoComprobante === 'factura'
                            ? `Factura · RUC ${datos.ruc_factura} · ${datos.razon_social_factura.trim()}`
                            : 'Boleta'}
                        </dd>
                        <button type="button" className="review-edit" onClick={() => irAPaso(pasos.indexOf('comprobante'))}>Editar</button>
                      </div>
                    </dl>
                    {campo('notas', {
                      etiqueta: <>Notas para el pedido <span>(opcional)</span></>,
                      completo: true,
                      multilinea: true,
                      placeholder: 'Indica alguna consideración para tu pedido.',
                    })}
                    <label className="terms-check">
                      <input
                        id="terms"
                        name="terms"
                        type="checkbox"
                        checked={datos.terminos}
                        aria-invalid={errores.terminos ? true : undefined}
                        aria-describedby={errores.terminos ? 'terms-error' : undefined}
                        onChange={(evento) => {
                          setDatos((previos) => ({ ...previos, terminos: evento.target.checked }));
                          setErrores((previos) => ({ ...previos, terminos: undefined }));
                        }}
                      />
                      <span>He revisado los datos de mi pedido y acepto continuar con el proceso de pago.</span>
                    </label>
                    {errores.terminos ? <p id="terms-error" className="field-error" role="alert">{errores.terminos}</p> : null}
                    {errorEnvio ? <p className="state-message error-state submit-error" role="alert">{errorEnvio}</p> : null}
                  </>
                ) : null}

                <div className="step-actions">
                  {indicePaso > 0 ? (
                    <button type="button" className="button-secondary" onClick={retroceder} disabled={enviando}>
                      ← Atrás
                    </button>
                  ) : <span />}
                  {esUltimoPaso ? (
                    <button id="submit-order" className="button-primary submit-order" type="submit" disabled={enviando}>
                      {enviando ? 'Registrando pedido…' : 'Registrar pedido y continuar'}
                    </button>
                  ) : (
                    <button className="button-primary" type="submit">Continuar →</button>
                  )}
                </div>
                {esUltimoPaso ? (
                  <p className="payment-disclaimer">
                    Al registrar el pedido no se solicitarán datos de tarjeta en esta página. El pago en línea se
                    conectará mediante una pasarela externa segura.
                  </p>
                ) : null}
              </section>
            </form>
          </div>

          <aside className={`summary-card${resumenAbierto ? ' is-open' : ''}`} aria-label="Resumen del pedido">
            <button
              type="button"
              className="summary-toggle"
              aria-expanded={resumenAbierto}
              aria-controls="resumen-contenido"
              onClick={() => setResumenAbierto((abierto) => !abierto)}
            >
              <span>Resumen de compra</span>
              <strong>{precioTexto(total)}</strong>
            </button>
            <div id="resumen-contenido" className="summary-body">
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
            </div>
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
