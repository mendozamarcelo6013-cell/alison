import { cuerpoJson, pedirJson } from './client';
import type { ConfiguracionPago, RespuestaCheckoutPago } from '../types';

/** GET /api/pagos/configuracion */
export function obtenerConfiguracionPago(): Promise<ConfiguracionPago> {
  return pedirJson<ConfiguracionPago>('/api/pagos/configuracion');
}

/** POST /api/pagos/checkout — devuelve la URL de la pasarela cuando exista. */
export function iniciarCheckoutPago(numeroPedido: string): Promise<RespuestaCheckoutPago> {
  return pedirJson<RespuestaCheckoutPago>('/api/pagos/checkout', cuerpoJson('POST', { numero_pedido: numeroPedido }));
}
