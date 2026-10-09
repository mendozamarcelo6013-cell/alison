import type { RespuestaApi } from '../types';

/**
 * Capa HTTP centralizada. Todas las peticiones usan rutas relativas a la raíz
 * del sitio: en desarrollo Vite las proxea hacia Express y en producción las
 * sirve el propio Express. No se duplica ningún dominio ni credencial.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly codigo?: string;

  constructor(mensaje: string, status: number, codigo?: string) {
    super(mensaje);
    this.name = 'ApiError';
    this.status = status;
    this.codigo = codigo;
  }
}

export interface ResultadoHttp<T> {
  status: number;
  ok: boolean;
  datos: T;
}

export const ERROR_CATALOGO = 'No se pudo cargar el catálogo.';
export const ERROR_PRODUCTO = 'No se pudo cargar el producto.';
export const ERROR_PEDIDO = 'No fue posible registrar el pedido.';

function esApiError(esquema: unknown): esquema is { ok?: boolean; mensaje?: string; codigo?: string } {
  return typeof esquema === 'object' && esquema !== null;
}

export async function pedir<T>(
  ruta: string,
  opciones: RequestInit = {},
): Promise<ResultadoHttp<T>> {
  let respuesta: Response;

  try {
    respuesta = await fetch(ruta, opciones);
  } catch {
    throw new ApiError('No se pudo conectar con el servidor.', 0);
  }

  let datos: T;
  try {
    datos = (await respuesta.json()) as T;
  } catch {
    datos = { ok: respuesta.ok } as unknown as T;
  }

  const exito = respuesta.ok && (!esApiError(datos) || datos.ok !== false);
  return { status: respuesta.status, ok: exito, datos };
}

/** Lanza ApiError cuando la respuesta no es válida. */
export async function pedirJson<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const resultado = await pedir<T>(ruta, opciones);
  if (!resultado.ok) {
    const mensaje = esApiError(resultado.datos) ? resultado.datos.mensaje : undefined;
    const codigo = esApiError(resultado.datos) ? resultado.datos.codigo : undefined;
    throw new ApiError(
      mensaje || `Error HTTP ${resultado.status}`,
      resultado.status,
      codigo,
    );
  }
  return resultado.datos;
}

export function cuerpoJson(metodo: string, cuerpo: unknown): RequestInit {
  return {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  };
}

/** Normaliza cualquier error a un mensaje mostrable sin filtrar tipos raros. */
export function mensajeError(error: unknown, alternativa: string): string {
  if (error instanceof Error && typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }
  return alternativa;
}

export function esRespuestaError(datos: RespuestaApi | undefined): boolean {
  return !datos || datos.ok === false;
}
