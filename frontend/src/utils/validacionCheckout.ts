/** Validación por paso del checkout (pura, para poder probarla sin React). */

export type PasoCheckout = 'contacto' | 'entrega' | 'comprobante' | 'confirmacion';
export type MetodoEntrega = 'envio_domicilio' | 'recojo_tienda';
export type TipoComprobante = 'boleta' | 'factura';

export interface DatosCheckout {
  email: string;
  destinatario: string;
  telefono: string;
  metodoEntrega: MetodoEntrega;
  departamento: string;
  provincia: string;
  distrito: string;
  direccion_linea1: string;
  referencia: string;
  tipoComprobante: TipoComprobante;
  dni_boleta: string;
  ruc_factura: string;
  razon_social_factura: string;
  direccion_factura: string;
  notas: string;
  terminos: boolean;
}

export type CampoCheckout = Exclude<keyof DatosCheckout, 'metodoEntrega' | 'tipoComprobante' | 'referencia' | 'notas'>;
export type ErroresCheckout = Partial<Record<CampoCheckout, string>>;

export const DATOS_CHECKOUT_INICIALES: DatosCheckout = {
  email: '',
  destinatario: '',
  telefono: '',
  metodoEntrega: 'envio_domicilio',
  departamento: '',
  provincia: '',
  distrito: '',
  direccion_linea1: '',
  referencia: '',
  tipoComprobante: 'boleta',
  dni_boleta: '',
  ruc_factura: '',
  razon_social_factura: '',
  direccion_factura: '',
  notas: '',
  terminos: false,
};

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Longitud exacta de los documentos: ni más ni menos dígitos. */
export const DIGITOS_DNI = 8;
export const DIGITOS_RUC = 11;
const DNI = new RegExp(`^\\d{${DIGITOS_DNI}}$`);
const RUC = new RegExp(`^\\d{${DIGITOS_RUC}}$`);
const MINIMO_DIGITOS_TELEFONO = 6;

const vacio = (valor: string) => valor.trim() === '';

/** Orden en que se recorren los campos (para enfocar el primero con error). */
export const ORDEN_CAMPOS: CampoCheckout[] = [
  'email', 'destinatario', 'telefono',
  'departamento', 'provincia', 'distrito', 'direccion_linea1',
  'dni_boleta', 'ruc_factura', 'razon_social_factura', 'direccion_factura',
  'terminos',
];

export function validarPaso(paso: PasoCheckout, datos: DatosCheckout): ErroresCheckout {
  const errores: ErroresCheckout = {};

  if (paso === 'contacto') {
    if (vacio(datos.email)) errores.email = 'Ingresa tu correo electrónico.';
    else if (!CORREO.test(datos.email.trim())) errores.email = 'Ingresa un correo válido, por ejemplo nombre@dominio.com.';

    if (vacio(datos.destinatario)) {
      errores.destinatario = datos.metodoEntrega === 'recojo_tienda'
        ? 'Ingresa el nombre de quien recogerá el pedido.'
        : 'Ingresa tu nombre y apellidos.';
    }

    const digitos = datos.telefono.replace(/\D/g, '');
    if (vacio(datos.telefono)) errores.telefono = 'Ingresa un número de contacto.';
    else if (digitos.length < MINIMO_DIGITOS_TELEFONO) errores.telefono = 'Ingresa un número de teléfono válido.';
  }

  if (paso === 'entrega' && datos.metodoEntrega === 'envio_domicilio') {
    if (vacio(datos.departamento)) errores.departamento = 'Ingresa el departamento.';
    if (vacio(datos.provincia)) errores.provincia = 'Ingresa la provincia.';
    if (vacio(datos.distrito)) errores.distrito = 'Ingresa el distrito.';
    if (vacio(datos.direccion_linea1)) errores.direccion_linea1 = 'Ingresa la dirección de entrega.';
  }

  if (paso === 'comprobante' && datos.tipoComprobante === 'boleta') {
    if (vacio(datos.dni_boleta)) errores.dni_boleta = 'Ingresa el DNI.';
    else if (!DNI.test(datos.dni_boleta.trim())) errores.dni_boleta = `El DNI debe tener ${DIGITOS_DNI} dígitos.`;
  }

  if (paso === 'comprobante' && datos.tipoComprobante === 'factura') {
    if (vacio(datos.ruc_factura)) errores.ruc_factura = 'Ingresa el RUC.';
    else if (!RUC.test(datos.ruc_factura.trim())) errores.ruc_factura = `El RUC debe tener ${DIGITOS_RUC} dígitos.`;
    if (vacio(datos.razon_social_factura)) errores.razon_social_factura = 'Ingresa la razón social.';
    if (vacio(datos.direccion_factura)) errores.direccion_factura = 'Ingresa la dirección fiscal.';
  }

  if (paso === 'confirmacion' && !datos.terminos) {
    errores.terminos = 'Debes confirmar que revisaste los datos para registrar el pedido.';
  }

  return errores;
}

export function primerCampoConError(errores: ErroresCheckout): CampoCheckout | null {
  return ORDEN_CAMPOS.find((campo) => errores[campo] !== undefined) ?? null;
}
