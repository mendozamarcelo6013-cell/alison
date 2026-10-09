import { cuerpoJson, pedirJson } from './client';
import type { PayloadPedido, RespuestaPedido } from '../types';

/** POST /api/pedidos — el backend valida, calcula precios, IGV y reserva stock. */
export function crearPedido(payload: PayloadPedido): Promise<RespuestaPedido> {
  return pedirJson<RespuestaPedido>('/api/pedidos', cuerpoJson('POST', payload));
}
