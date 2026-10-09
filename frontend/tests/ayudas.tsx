import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import { App } from '../src/App';
import { CartProvider } from '../src/state/CartContext';

export interface ReglaRuta {
  /** Prefijo de la URL (p. ej. `/api/productos/laptop`). */
  coincidir: string;
  datos: unknown;
  status?: number;
}

export interface Llamada {
  url: string;
  init?: RequestInit;
}

/**
 * Stub de `fetch` que sólo lee `ok`, `status` y `json()` (lo que usa la capa
 * HTTP real). Devuelve 404 con `{ ok:false }` cuando ninguna regla coincide.
 */
export function crearFetch(reglas: ReglaRuta[] = []) {
  const llamadas: Llamada[] = [];

  const fetchStub = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof entrada === 'string' ? entrada : entrada.toString();
    llamadas.push({ url, init });

    const regla = reglas.find((candidata) => url.startsWith(candidata.coincidir));
    const status = regla ? (regla.status ?? 200) : 404;
    const datos = regla ? regla.datos : { ok: false, mensaje: 'Recurso no encontrado.' };

    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => datos,
    } as unknown as Response;
  });

  return { fetchStub, llamadas };
}

export function cuerpoJson<T>(llamada: Llamada | undefined): T {
  if (!llamada?.init?.body) throw new Error('La llamada no lleva cuerpo JSON.');
  return JSON.parse(String(llamada.init.body)) as T;
}

export function llamadaPorUrl(llamadas: Llamada[], url: string): Llamada | undefined {
  return llamadas.find((llamada) => llamada.url === url);
}

export function cabecera(llamada: Llamada | undefined, nombre: string): string {
  const headers = llamada?.init?.headers as Record<string, string> | undefined;
  return headers?.[nombre] ?? '';
}

export function productoDePrueba(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    nombre: 'Laptop HP 15',
    slug: 'laptop-hp-15',
    sku: 'LAP-001',
    descripcion_corta: 'Equipo portátil para estudio.',
    descripcion: 'Descripción completa del equipo.',
    tipo: 'fisico',
    precio: '2499.90',
    moneda: 'PEN',
    stock: 5,
    controla_stock: true,
    destacado: false,
    activo: true,
    categoria_id: 1,
    tasa_igv: '0.18',
    peso_gramos: 1800,
    categoria: { id: 1, nombre: 'Laptops', slug: 'laptops' },
    imagenes: [],
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-01-05T10:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Montaje de la SPA en pruebas (React Router)
// ---------------------------------------------------------------------------

function SondaUbicacion() {
  const ubicacion = useLocation();
  return <output data-testid="ubicacion">{ubicacion.pathname + ubicacion.search}</output>;
}

/**
 * Pinta la SPA real (`App`) en la ruta indicada, con el contexto del carrito y
 * una sonda que expone la URL interna actual para poder asertar la navegación.
 */
export function pintarApp(ruta = '/market') {
  // Permite varias montajes dentro del mismo test (p. ej. redirecciones).
  cleanup();
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <CartProvider>
        <SondaUbicacion />
        <App />
      </CartProvider>
    </MemoryRouter>,
  );
}

/** Ruta actual dentro del MemoryRouter (p. ej. `/market/carrito`). */
export function ubicacionActual(): string {
  return screen.getByTestId('ubicacion').textContent ?? '';
}

export const ATRIBUTO_HOJA = 'data-hojas';

/** Hojas con `media="all"` (las activas de la ruta actual). */
export function hojasActivas(): string[] {
  return [...document.querySelectorAll<HTMLLinkElement>(`link[${ATRIBUTO_HOJA}]`)]
    .filter((enlace) => enlace.media === 'all')
    .map((enlace) => enlace.getAttribute(ATRIBUTO_HOJA) ?? '');
}

/** `media` de una hoja concreta (`''` si el enlace no existe). */
export function mediaDeHoja(clave: string): string {
  const enlace = document.querySelector<HTMLLinkElement>(`link[${ATRIBUTO_HOJA}="${clave}"]`);
  return enlace?.media ?? '';
}
