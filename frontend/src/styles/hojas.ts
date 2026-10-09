/**
 * Hojas de estilo de la SPA.
 *
 * En el sitio MPA cada documento enlazaba exactamente dos hojas (las compartidas
 * + la suya). Al convivir todas las rutas en un único documento, cargarlas juntas
 * produce colisiones reales: `.quantity-control` (producto vs. carrito),
 * `.summary-card`/`.page-heading` (carrito vs. checkout), `.product-name` y
 * `.image-placeholder` (catálogo vs. detalle) y los selectores `h1`/`h2` globales
 * de market.css.
 *
 * Por eso cada hoja viaja enlazada una sola vez en index.html con
 * `media="not all"` y sólo se activa (`media="all"`) la de la ruta actual. Así el
 * CSS nunca se inyecta como `<style>`: el CSP de /horus-admin sólo admite
 * `style-src 'self'` y rechaza nodos creados por script. El contrato es que
 * index.html enlaza las seis hojas con `data-hojas` en `ORDEN_HOJAS`.
 */

export type Hoja = 'compartido' | 'catalogo' | 'producto' | 'carrito' | 'checkout' | 'admin';

/** Orden de cascada en index.html (misma precedencia que en el MPA). */
export const ORDEN_HOJAS: Hoja[] = ['compartido', 'catalogo', 'producto', 'carrito', 'checkout', 'admin'];

/**
 * Hojas activas para una ruta: cada vista conserva exactamente las que tenía en
 * el MPA, en el mismo orden. `/horus-admin` sólo activa `admin.css` (el panel no
 * enlazaba market-shared.css) y el 404 sólo la hoja compartida.
 */
export function hojasParaRuta(pathname: string): Hoja[] {
  if (
    pathname === '/horus-admin'
    || pathname.startsWith('/horus-admin/')
    || pathname === '/admin'
    || pathname.startsWith('/admin/')
    || pathname === '/admin.html'
  ) return ['admin'];

  const base: Hoja[] = ['compartido'];

  if (pathname === '/market') return [...base, 'catalogo'];
  if (pathname.startsWith('/market/producto')) return [...base, 'producto'];
  if (pathname.startsWith('/market/carrito')) return [...base, 'carrito'];
  if (pathname.startsWith('/market/checkout')) return [...base, 'checkout'];

  return base;
}
