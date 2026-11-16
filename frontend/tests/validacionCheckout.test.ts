import { describe, expect, it } from 'vitest';
import {
  DATOS_CHECKOUT_INICIALES,
  primerCampoConError,
  validarPaso,
  type DatosCheckout,
} from '../src/utils/validacionCheckout';

const datos = (cambios: Partial<DatosCheckout> = {}): DatosCheckout => ({ ...DATOS_CHECKOUT_INICIALES, ...cambios });

describe('validarPaso', () => {
  it('exige correo, nombre y teléfono en el contacto', () => {
    const errores = validarPaso('contacto', datos());
    expect(Object.keys(errores)).toEqual(['email', 'destinatario', 'telefono']);
  });

  it('rechaza correos y teléfonos mal formados', () => {
    const errores = validarPaso('contacto', datos({ email: 'ana@', destinatario: 'Ana', telefono: '12' }));
    expect(errores.email).toMatch(/válido/);
    expect(errores.telefono).toMatch(/válido/);
    expect(validarPaso('contacto', datos({ email: 'ana@horus.test', destinatario: 'Ana', telefono: '+51 999 888 777' }))).toEqual({});
  });

  it('pide la dirección sólo en envío a domicilio', () => {
    expect(Object.keys(validarPaso('entrega', datos()))).toEqual([
      'departamento', 'provincia', 'distrito', 'direccion_linea1',
    ]);
    expect(validarPaso('entrega', datos({ metodoEntrega: 'recojo_tienda' }))).toEqual({});
  });

  it('pide DNI de exactamente 8 dígitos sólo para boleta', () => {
    expect(validarPaso('comprobante', datos()).dni_boleta).toBe('Ingresa el DNI.');
    expect(validarPaso('comprobante', datos({ dni_boleta: '1234567' })).dni_boleta).toMatch(/8 dígitos/);
    expect(validarPaso('comprobante', datos({ dni_boleta: '123456789' })).dni_boleta).toMatch(/8 dígitos/);
    expect(validarPaso('comprobante', datos({ dni_boleta: '12345678' }))).toEqual({});
    expect(validarPaso('comprobante', datos({ tipoComprobante: 'factura', dni_boleta: '' })).dni_boleta).toBeUndefined();
  });

  it('pide RUC de 11 dígitos, razón social y dirección fiscal sólo para factura', () => {
    expect(validarPaso('comprobante', datos({ dni_boleta: '12345678' }))).toEqual({});
    expect(validarPaso('comprobante', datos({
      tipoComprobante: 'factura', ruc_factura: '201234567890', razon_social_factura: 'E', direccion_factura: 'D',
    })).ruc_factura).toMatch(/11 dígitos/);
    const errores = validarPaso('comprobante', datos({ tipoComprobante: 'factura', ruc_factura: '123' }));
    expect(errores.ruc_factura).toMatch(/11 dígitos/);
    expect(errores.razon_social_factura).toBeDefined();
    expect(errores.direccion_factura).toBeDefined();
    expect(validarPaso('comprobante', datos({
      tipoComprobante: 'factura',
      ruc_factura: '20123456789',
      razon_social_factura: 'Empresa SAC',
      direccion_factura: 'Av. Fiscal 1',
    }))).toEqual({});
  });

  it('exige confirmar los datos en el último paso', () => {
    expect(validarPaso('confirmacion', datos()).terminos).toBeDefined();
    expect(validarPaso('confirmacion', datos({ terminos: true }))).toEqual({});
  });

  it('devuelve el primer campo con error en orden de pantalla', () => {
    expect(primerCampoConError({ telefono: 'x', email: 'y' })).toBe('email');
    expect(primerCampoConError({})).toBeNull();
  });
});
