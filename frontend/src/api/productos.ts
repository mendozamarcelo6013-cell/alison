import { pedir, pedirJson } from './client';
import { CacheVigente } from './cache';
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

/** Vigencia tras la cual la vista revalida en segundo plano. */
const VIGENCIA_CATALOGO_MS = 60_000;
const VIGENCIA_DETALLE_MS = 60_000;
const CLAVE_CATALOGO = 'catalogo';

const cacheCatalogo = new CacheVigente<Catalogo>(VIGENCIA_CATALOGO_MS);
const cacheDetalle = new CacheVigente<ProductoDetalle>(VIGENCIA_DETALLE_MS);

/** Catálogo guardado (aunque esté vencido) para pintar sin esperas. */
export function catalogoEnCache(): { datos: Catalogo; vigente: boolean } | null {
  const datos = cacheCatalogo.leer(CLAVE_CATALOGO);
  return datos ? { datos, vigente: cacheCatalogo.estaVigente(CLAVE_CATALOGO) } : null;
}

/** Detalle guardado (aunque esté vencido) para pintar sin esperas. */
export function detalleEnCache(slug: string): { producto: ProductoDetalle; vigente: boolean } | null {
  const producto = cacheDetalle.leer(slug);
  return producto ? { producto, vigente: cacheDetalle.estaVigente(slug) } : null;
}

/**
 * Descarta lo guardado: debe llamarse cuando el stock cambia por una acción
 * propia (p. ej. tras registrar un pedido) para no mostrar existencias viejas.
 */
export function invalidarCacheProductos(): void {
  cacheCatalogo.vaciar();
  cacheDetalle.vaciar();
}

/** GET /api/categorias + GET /api/productos (en paralelo, como el original). */
export function obtenerCatalogo(): Promise<Catalogo> {
  return cacheCatalogo.cargar(CLAVE_CATALOGO, descargarCatalogo);
}

async function descargarCatalogo(): Promise<Catalogo> {
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
 * checkout necesitan distinguir 404 de otros fallos. SIEMPRE va a la red (es la
 * fuente de verdad para precio y stock en compras); el resultado fresco sólo
 * se aprovecha para refrescar la caché de la vista.
 */
export async function consultarProducto(slug: string): Promise<ConsultaProducto> {
  try {
    const resultado = await pedir<DetalleProducto>(`/api/productos/${encodeURIComponent(slug)}`);
    const esquema = resultado.datos as { mensaje?: unknown } | undefined;
    if (resultado.ok && resultado.datos.producto) cacheDetalle.guardar(slug, resultado.datos.producto);
    else if (resultado.status === 404) cacheDetalle.invalidar(slug);
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

/**
 * Igual que `consultarProducto`, pero las consultas simultáneas del mismo
 * producto comparten una petición. Para la página de detalle (nunca compras).
 */
const detalleEnVuelo = new Map<string, Promise<ConsultaProducto>>();

export function consultarProductoParaVista(slug: string): Promise<ConsultaProducto> {
  const pendiente = detalleEnVuelo.get(slug);
  if (pendiente) return pendiente;
  const peticion = consultarProducto(slug).finally(() => detalleEnVuelo.delete(slug));
  detalleEnVuelo.set(slug, peticion);
  return peticion;
}
