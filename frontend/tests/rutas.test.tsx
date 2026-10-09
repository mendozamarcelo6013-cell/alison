import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CART_KEY } from '../src/state/cart';
import { hojasActivas, crearFetch, mediaDeHoja, pintarApp, productoDePrueba, ubicacionActual } from './ayudas';

function stubCatalogo() {
  const { fetchStub } = crearFetch([
    { coincidir: '/api/categorias', datos: { ok: true, categorias: [] } },
    { coincidir: '/api/productos', datos: { ok: true, productos: [productoDePrueba()] } },
  ]);
  vi.stubGlobal('fetch', fetchStub);
  return fetchStub;
}

describe('Rutas de la SPA', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // La URL real del documento no debe cambiar al navegar dentro de la SPA.
    window.history.replaceState({}, '', '/market');
  });

  it('redirige la raíz a /market', async () => {
    stubCatalogo();
    pintarApp('/');
    expect(await screen.findByText('Laptop HP 15')).toBeInTheDocument();
    expect(ubicacionActual()).toBe('/market');
    expect(document.title).toBe('Market | Horus Group');
  });

  it('navega del catálogo al detalle por slug sin recargar el documento', async () => {
    const { fetchStub } = crearFetch([
      { coincidir: '/api/categorias', datos: { ok: true, categorias: [] } },
      { coincidir: '/api/productos/laptop-hp-15', datos: { ok: true, producto: productoDePrueba() } },
      { coincidir: '/api/productos', datos: { ok: true, productos: [productoDePrueba()] } },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    pintarApp('/market');
    await screen.findByText('Laptop HP 15');

    await userEvent.click(screen.getByRole('link', { name: 'Ver producto' }));

    expect(ubicacionActual()).toBe('/market/producto/laptop-hp-15');
    // Si hubiera recarga total, window.location habría cambiado.
    expect(window.location.pathname).toBe('/market');
    expect(await screen.findByRole('heading', { name: 'Laptop HP 15' })).toBeInTheDocument();
    expect(document.title).toBe('Producto | Horus Market');
  });

  it('no muestra un enlace público al panel administrativo', async () => {
    stubCatalogo();
    pintarApp('/market');
    await screen.findByText('Laptop HP 15');

    expect(screen.queryByRole('link', { name: 'Ingresar al panel de administración' })).not.toBeInTheDocument();
  });

  it('mantiene el carrito al cambiar de ruta', async () => {
    localStorage.setItem(
      CART_KEY,
      JSON.stringify([{ producto_id: 1, slug: 'laptop-hp-15', cantidad: 2 }]),
    );
    const { fetchStub } = crearFetch([
      { coincidir: '/api/categorias', datos: { ok: true, categorias: [] } },
      { coincidir: '/api/productos/laptop-hp-15', datos: { ok: true, producto: productoDePrueba() } },
      { coincidir: '/api/productos', datos: { ok: true, productos: [productoDePrueba()] } },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    pintarApp('/market');
    await screen.findByText('Laptop HP 15');

    expect(document.querySelector('[data-cart-count]')?.textContent).toBe('2');
    await userEvent.click(screen.getByRole('link', { name: /^Carrito/ }));

    expect(ubicacionActual()).toBe('/market/carrito');
    expect(await screen.findByText('Laptop HP 15')).toBeInTheDocument();
    expect(screen.getByText('Subtotal: S/ 4999.80')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(CART_KEY) || '[]')).toEqual([
      { producto_id: 1, slug: 'laptop-hp-15', cantidad: 2 },
    ]);
  });

  it('redirige las URLs antiguas del MPA', async () => {
    stubCatalogo();

    pintarApp('/market.html');
    expect(ubicacionActual()).toBe('/market');

    pintarApp('/market-carrito.html');
    expect(ubicacionActual()).toBe('/market/carrito');

    pintarApp('/market-checkout.html');
    expect(ubicacionActual()).toBe('/market/checkout');

    pintarApp('/admin');
    expect(ubicacionActual()).toBe('/horus-admin');

    pintarApp('/admin.html');
    expect(ubicacionActual()).toBe('/horus-admin');
  });

  it('convierte market-producto.html?slug= en /market/producto/:slug', () => {
    stubCatalogo();
    pintarApp('/market-producto.html?slug=laptop-hp-15');
    expect(ubicacionActual()).toBe('/market/producto/laptop-hp-15');
  });

  it('muestra la vista de página no encontrada en rutas desconocidas', async () => {
    const { fetchStub } = crearFetch();
    vi.stubGlobal('fetch', fetchStub);

    pintarApp('/ruta-que-no-existe');

    expect(await screen.findByText('Página no encontrada')).toBeInTheDocument();
    expect(ubicacionActual()).toBe('/ruta-que-no-existe');
    expect(document.title).toBe('Página no encontrada | Horus Market');
    expect(fetchStub).not.toHaveBeenCalled();
  });
});

describe('CSS por ruta', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('sólo activa las hojas del catálogo en /market', async () => {
    stubCatalogo();
    pintarApp('/market');
    await screen.findByText('Laptop HP 15');

    expect(hojasActivas()).toEqual(['compartido', 'catalogo']);
    expect(mediaDeHoja('carrito')).toBe('not all');
    expect(mediaDeHoja('checkout')).toBe('not all');
    expect(mediaDeHoja('admin')).toBe('not all');
    expect(document.querySelectorAll('style')).toHaveLength(0);
  });

  it('sólo activa las hojas del carrito en /market/carrito', () => {
    pintarApp('/market/carrito');

    expect(hojasActivas()).toEqual(['compartido', 'carrito']);
    expect(mediaDeHoja('catalogo')).toBe('not all');
    expect(mediaDeHoja('producto')).toBe('not all');
    expect(mediaDeHoja('checkout')).toBe('not all');
    expect(mediaDeHoja('admin')).toBe('not all');
    expect(document.querySelectorAll('style')).toHaveLength(0);
  });

  it('activa sólo admin.css en /horus-admin sin crear <style> (CSP style-src self)', async () => {
    pintarApp('/horus-admin');
    await screen.findByText('Acceso al panel');

    expect(hojasActivas()).toEqual(['admin']);
    expect(mediaDeHoja('compartido')).toBe('not all');
    expect(mediaDeHoja('catalogo')).toBe('not all');
    expect(document.getElementById('spa-estilos-ruta')).toBeNull();
    expect(document.querySelectorAll('style')).toHaveLength(0);
  });
});
