import { cuerpoJson, pedirJson } from './client';
import type { PayloadPedido, RespuestaPedido } from '../types';

/** POST /api/pedidos — el backend valida, calcula precios, IGV y reserva stock. */
export function crearPedido(payload: PayloadPedido): Promise<RespuestaPedido> {
  return pedirJson<RespuestaPedido>('/api/pedidos', cuerpoJson('POST', payload));
}

export function consultarEstadoPedido(numero: string, telefono: string): Promise<{
  ok: true;
  numero_pedido: string;
  metodo_entrega: 'envio_domicilio' | 'recojo_tienda';
  etiqueta_estado: string;
  estado: string;
  direccion_entrega?: import('../types').DireccionRecojo;
}> {
  const params = new URLSearchParams({ telefono });
  return pedirJson(`/api/pedidos/${encodeURIComponent(numero)}?${params.toString()}`);
}
