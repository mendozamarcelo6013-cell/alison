/**
 * Contratos reales de la API REST de Express (src/controllers/*).
 * Los nombres de campo replican exactamente los que devuelve el backend.
 */

/** Los DECIMAL de Sequelize viajan como string o number según el driver. */
export type Decimal = string | number;

export interface RespuestaOk {
  ok: true;
  mensaje?: string;
}

export interface RespuestaError {
  ok: false;
  mensaje?: string;
  codigo?: string;
}

export type RespuestaApi = RespuestaOk | RespuestaError;

export interface CategoriaRef {
  id: number;
  nombre: string;
  slug: string;
  parent_id?: number | null;
}

export interface Categoria extends CategoriaRef {
  descripcion?: string | null;
  imagen_url?: string | null;
  activa?: boolean;
  orden?: number;
  parent_id?: number | null;
}

export interface ProductoImagen {
  id: number;
  url: string;
  texto_alternativo: string | null;
  orden: number;
  principal: boolean;
}

export interface ProductoCatalogo {
  id: number;
  nombre: string;
  slug: string;
  descripcion_corta: string | null;
  descripcion: string | null;
  tipo: TipoProducto;
  precio: Decimal;
  moneda: string;
  stock: number;
  controla_stock: boolean;
  destacado: boolean;
  categoria?: CategoriaRef | null;
  imagenes: ProductoImagen[];
}

export interface ProductoDetalle extends ProductoCatalogo {
  sku: string | null;
}

export type TipoProducto = 'fisico' | 'servicio' | 'digital';

export interface MovimientoStock {
  id: number;
  tipo: string;
  cantidad: number;
  stock_resultante: number;
  nota: string | null;
  createdAt: string;
}

export interface ProductoAdmin extends ProductoDetalle {
  categoria_id: number | null;
  tasa_igv: Decimal;
  peso_gramos: number | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  movimientosStock?: MovimientoStock[];
}

export interface Paginacion {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListadoProductos {
  ok: true;
  productos: ProductoCatalogo[];
}

export interface DetalleProducto {
  ok: true;
  producto: ProductoDetalle;
}

export interface ListadoCategorias {
  ok: true;
  categorias: Categoria[];
}

export interface PedidoCreado {
  numero_pedido: string;
  fecha_creacion: string;
  estado: string;
  metodo_entrega: 'envio_domicilio' | 'recojo_tienda';
  estado_recojo?: EstadoRecojo | null;
  direccion_entrega?: DireccionEnvio | DireccionRecojo | null;
  tipo_comprobante: 'boleta' | 'factura';
  ruc_factura?: string | null;
  razon_social_factura?: string | null;
  direccion_factura?: string | null;
  subtotal: string;
  igv_total: string;
  envio_total: string;
  total: string;
  moneda: string;
}

export type EstadoRecojo = 'pendiente' | 'en_preparacion' | 'listo_para_recoger' | 'entregado';
export const ESTADOS_RECOJO: EstadoRecojo[] = ['pendiente', 'en_preparacion', 'listo_para_recoger', 'entregado'];
export const ETIQUETAS_ESTADO_RECOJO: Record<EstadoRecojo, string> = {
  pendiente: 'Pendiente',
  en_preparacion: 'En preparación',
  listo_para_recoger: 'Listo para recoger',
  entregado: 'Entregado',
};

export interface RespuestaPedido {
  ok: true;
  pedido: PedidoCreado;
}

export interface DireccionEnvio {
  departamento: string;
  provincia: string;
  distrito: string;
  direccion_linea1: string;
  referencia?: string;
}

export interface DireccionRecojo {
  tipo: 'recojo_tienda';
  nombre_tienda: string;
  direccion_linea1: string;
  referencia: string | null;
  horario: string | null;
  maps_url: string;
}

/** Payload exacto que espera POST /api/pedidos. */
export interface PayloadPedido {
  email: string;
  destinatario: string;
  telefono: string;
  tipo_comprobante: 'boleta' | 'factura';
  ruc_factura?: string;
  razon_social_factura?: string;
  direccion_factura?: string;
  metodo_entrega: 'envio_domicilio' | 'recojo_tienda';
  persona_recojo?: string;
  telefono_recojo?: string;
  direccion?: DireccionEnvio;
  notas: string;
  items: Array<{ slug: string; cantidad: number }>;
}

export interface PedidoAdmin {
  numero_pedido: string;
  metodo_entrega: 'envio_domicilio' | 'recojo_tienda';
  estado: string;
  estado_recojo: EstadoRecojo | null;
  tipo_comprobante: 'boleta' | 'factura';
  ruc_factura: string | null;
  razon_social_factura: string | null;
  direccion_factura: string | null;
  destinatario: string | null;
  telefono_entrega: string | null;
  email_cliente: string;
  direccion_entrega: DireccionEnvio | DireccionRecojo | null;
  total: Decimal;
  moneda: string;
  createdAt: string;
}

export interface ConfiguracionPago {
  ok: true;
  habilitada: boolean;
  proveedor: string | null;
}

export interface RespuestaCheckoutPago {
  ok: true;
  checkout_url: string;
}

export interface EstadisticasAdmin {
  total?: number;
  publicados?: number;
  borradores?: number;
  sinStock?: number;
  destacados?: number;
}

export interface ListadoProductosAdmin {
  ok: true;
  productos: ProductoAdmin[];
  paginacion: Paginacion;
}

export interface DetalleProductoAdmin {
  ok: true;
  producto: ProductoAdmin;
}

export interface UsuarioAdmin {
  id: number;
  email: string;
  nombres?: string | null;
  apellidos?: string | null;
  rol: string;
  activo?: boolean;
}

export interface RespuestaLogin {
  ok: true;
  mensaje?: string;
  token: string;
  usuario: UsuarioAdmin;
}

export interface RegistroAuditoria {
  id: number;
  usuario_id: number | null;
  usuario_email: string | null;
  accion: string;
  entidad: string;
  entidad_id: number | null;
  detalle: unknown;
  ip: string | null;
  createdAt: string;
}

export interface ListadoAuditoria {
  ok: true;
  registros: RegistroAuditoria[];
  paginacion: Paginacion;
  aviso?: string;
}

/** Elemento persistido en localStorage["horus_market_cart"]. */
export interface ItemCarrito {
  producto_id: number;
  slug: string;
  cantidad: number;
}

/** Producto del catálogo más la cantidad pedida (checkout). */
export type ProductoConCantidad = ProductoDetalle & { cantidad: number };

export type EstadoItemCarrito = 'disponible' | 'agotado' | 'no-disponible' | 'error';
