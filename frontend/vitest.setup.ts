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
