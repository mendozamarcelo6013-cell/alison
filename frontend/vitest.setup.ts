import '@testing-library/jest-dom/vitest';

// jsdom no carga index.html: se reproducen aquí los <link data-hojas> del shell
// de la SPA para que HojasDeRuta pueda alternarlos por ruta en las pruebas.
const HOJAS_SHELL = ['compartido', 'catalogo', 'producto', 'carrito', 'checkout', 'admin'];

for (const clave of HOJAS_SHELL) {
  const enlace = document.createElement('link');
  enlace.rel = 'stylesheet';
  enlace.href = `/css/${clave}.css`;
  enlace.media = 'not all';
  enlace.dataset.hojas = clave;
  document.head.appendChild(enlace);
}

import { afterEach, vi } from 'vitest';
import { invalidarCacheProductos } from './src/api/productos';
import { reiniciarFiltrosCatalogo } from './src/state/filtrosCatalogo';

// jsdom no implementa scrollTo (lo usa useScrollNavegacion).
window.scrollTo = vi.fn();

// La caché de la vista y los filtros viven a nivel de módulo: se aíslan por prueba.
afterEach(() => {
  invalidarCacheProductos();
  reiniciarFiltrosCatalogo();
});
