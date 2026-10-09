import { pedir, pedirJson } from './client';
import type {
  Categoria,
  DetalleProducto,
  ListadoCategorias,
  ListadoProductos,
  ProductoCatalogo,
  ProductoDetalle,
} from '../types';

export interface Catalogo {
  categorias: Categoria[];
  productos: ProductoCatalogo[];
}

/** GET /api/categorias + GET /api/productos (en paralelo, como el original). */
export async function obtenerCatalogo(): Promise<Catalogo> {
  const [respuestaCategorias, respuestaProductos] = await Promise.all([
    pedirJson<ListadoCategorias>('/api/categorias'),
    pedirJson<ListadoProductos>('/api/productos'),
  ]);

  return {
    categorias: Array.isArray(respuestaCategorias.categorias) ? respuestaCategorias.categorias : [],
    productos: Array.isArray(respuestaProductos.productos) ? respuestaProductos.productos : [],
  };
}

export interface ConsultaProducto {
  status: number;
  ok: boolean;
  producto?: ProductoDetalle;
  mensaje?: string;
}

/**
 * GET /api/productos/:slug sin lanzar por errores HTTP: el carrito y el
 * checkout necesitan distinguir 404 de otros fallos.
 */
export async function consultarProducto(slug: string): Promise<ConsultaProducto> {
  try {
    const resultado = await pedir<DetalleProducto>(`/api/productos/${encodeURIComponent(slug)}`);
    const esquema = resultado.datos as { mensaje?: unknown } | undefined;
    return {
      status: resultado.status,
      ok: resultado.ok,
      producto: resultado.ok ? resultado.datos.producto : undefined,
      mensaje: !resultado.ok && typeof esquema?.mensaje === 'string' ? esquema.mensaje : undefined,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      mensaje: error instanceof Error ? error.message : undefined,
    };
  }
}
