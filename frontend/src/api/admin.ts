import { cuerpoJson, pedir, pedirJson } from './client';
import type {
  Categoria,
  DetalleProductoAdmin,
  EstadisticasAdmin,
  ListadoAuditoria,
  ListadoCategorias,
  ListadoProductosAdmin,
  ProductoAdmin,
  RespuestaLogin,
  UsuarioAdmin,
} from '../types';

export const TOKEN_KEY = 'horus_admin_token';
export const MENSAJE_NO_AUTENTICADO = 'No autenticado. Inicia sesión como administrador.';
export const API_ADMIN = '/api/admin';

type OyenteNoAutenticado = () => void;

let leerToken: () => string = () => '';
let notificarNoAutenticado: OyenteNoAutenticado = () => {};

/**
 * Configura el proveedor de token y el aviso de sesión inválida.
 * El token vive solo en sessionStorage (nunca en localStorage) y sólo se
 * envía en la cabecera Authorization: Bearer.
 */
export function configurarAdminApi(opciones: {
  leerToken: () => string;
  notificarNoAutenticado: OyenteNoAutenticado;
}): void {
  leerToken = opciones.leerToken;
  notificarNoAutenticado = opciones.notificarNoAutenticado;
}

export function obtenerTokenAdmin(): string {
  return leerToken();
}

export function guardarTokenAdmin(token: string): void {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

function cabeceras(extra?: HeadersInit, esFormulario = false): HeadersInit {
  const token = leerToken();
  return {
    ...(esFormulario ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra || {}),
  };
}

/** Todas las rutas protegidas: GET/POST/PUT/DELETE/PATCH bajo /api/admin. */
export async function adminApi<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const esFormulario = opciones.body instanceof FormData;
  const resultado = await pedir<T>(`${API_ADMIN}${ruta}`, {
    ...opciones,
    headers: cabeceras(opciones.headers, esFormulario),
  });

  if (resultado.status === 401 || resultado.status === 403) {
    notificarNoAutenticado();
    throw new Error(MENSAJE_NO_AUTENTICADO);
  }
  if (!resultado.ok) {
    const mensaje = resultado.datos && typeof resultado.datos === 'object' && 'mensaje' in resultado.datos
      ? (resultado.datos as { mensaje?: string }).mensaje
      : undefined;
    throw new Error(mensaje || `Error HTTP ${resultado.status}`);
  }
  return resultado.datos;
}

/** POST /api/admin/auth/login — sin Bearer y sin registrar credenciales. */
export async function iniciarSesion(email: string, password: string): Promise<RespuestaLogin> {
  return pedirJson<RespuestaLogin>(
    `${API_ADMIN}/auth/login`,
    cuerpoJson('POST', { email, password }),
  );
}

/** GET /api/admin/auth/me */
export function verificarSesion(): Promise<{ ok: true; usuario: UsuarioAdmin }> {
  return adminApi<{ ok: true; usuario: UsuarioAdmin }>('/auth/me');
}

/** GET /api/admin/stats */
export function obtenerEstadisticas(): Promise<{ ok: true; stats: EstadisticasAdmin }> {
  return adminApi('/stats');
}

export interface FiltrosListado {
  page: number;
  limit: number;
  estado?: 'publicado' | 'borrador';
  sinStock?: boolean;
  destacado?: boolean;
  categoriaId?: string;
  busqueda?: string;
}

export function paramsListado(filtros: FiltrosListado): string {
  const params = new URLSearchParams({
    page: String(filtros.page),
    limit: String(filtros.limit),
  });
  if (filtros.estado === 'publicado' || filtros.estado === 'borrador') {
    params.set('estado', filtros.estado);
  }
  if (filtros.sinStock) params.set('sinStock', 'true');
  if (filtros.destacado) params.set('destacado', 'true');
  if (filtros.categoriaId) params.set('categoria_id', filtros.categoriaId);
  if (filtros.busqueda && filtros.busqueda.trim()) params.set('search', filtros.busqueda.trim());
  return params.toString();
}

export function listarProductosAdmin(filtros: FiltrosListado): Promise<ListadoProductosAdmin> {
  return adminApi(`/productos?${paramsListado(filtros)}`);
}

export function obtenerProductoAdmin(id: number): Promise<DetalleProductoAdmin> {
  return adminApi(`/productos/${id}`);
}

export function listarCategoriasAdmin(): Promise<{ ok: true; categorias: Categoria[] }> {
  return adminApi<ListadoCategorias>('/categorias');
}

export function listarAuditoriaAdmin(limit: number): Promise<ListadoAuditoria> {
  return adminApi(`/auditoria?limit=${limit}`);
}

export interface PayloadProductoAdmin {
  nombre: string;
  slug: string;
  sku: string;
  categoria_id: number | null;
  tipo: string;
  precio: number;
  moneda: string;
  stock: number;
  motivo_stock?: string;
  peso_gramos: number | null;
  descripcion_corta: string | null;
  descripcion: string | null;
  imagen_url: string;
  imagen_texto: string;
  activo: boolean;
  destacado: boolean;
  controla_stock: boolean;
}

export function crearProductoAdmin(payload: PayloadProductoAdmin): Promise<{ ok: true; producto: ProductoAdmin }> {
  return adminApi('/productos', cuerpoJson('POST', payload));
}

export function actualizarProductoAdmin(
  id: number,
  payload: Partial<PayloadProductoAdmin>,
): Promise<{ ok: true; producto: ProductoAdmin }> {
  return adminApi(`/productos/${id}`, cuerpoJson('PUT', payload));
}

export function enviarAPapelera(id: number): Promise<{ ok: true; mensaje?: string }> {
  return adminApi(`/productos/${id}`, { method: 'DELETE' });
}

export function restaurarProducto(id: number): Promise<{ ok: true; mensaje?: string }> {
  return adminApi(`/productos/${id}/restaurar`, { method: 'POST' });
}

export function subirImagenes(id: number, formulario: FormData): Promise<{ ok: true; mensaje?: string }> {
  return adminApi(`/productos/${id}/imagenes`, { method: 'POST', body: formulario });
}

export function eliminarImagen(id: number, imagenId: number): Promise<{ ok: true; mensaje?: string }> {
  return adminApi(`/productos/${id}/imagenes/${imagenId}`, { method: 'DELETE' });
}

export function fijarImagenPrincipal(id: number, imagenId: number): Promise<{ ok: true; mensaje?: string }> {
  return adminApi(`/productos/${id}/imagenes/${imagenId}/principal`, { method: 'PATCH' });
}
