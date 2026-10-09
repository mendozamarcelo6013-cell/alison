import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CART_KEY } from '../src/state/cart';
import { crearFetch, pintarApp, productoDePrueba, ubicacionActual } from './ayudas';

function pintar(ruta = '/market/producto/laptop-hp-15') {
  return pintarApp(ruta);
}

describe('Detalle de producto', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('consulta el producto por slug y pinta sus datos', async () => {
    const { fetchStub, llamadas } = crearFetch([
      { coincidir: '/api/productos/laptop-hp-15', datos: { ok: true, producto: productoDePrueba() } },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    pintar();

    expect(await screen.findByRole('heading', { name: 'Laptop HP 15' })).toBeInTheDocument();
    expect(screen.getByText('S/ 2499.90')).toBeInTheDocument();
    expect(screen.getByText('Equipo portátil para estudio.')).toBeInTheDocument();
    expect(llamadas[0].url).toBe('/api/productos/laptop-hp-15');
  });

  it('agrega al carrito respetando la clave horus_market_cart', async () => {
    const { fetchStub } = crearFetch([
      { coincidir: '/api/productos/laptop-hp-15', datos: { ok: true, producto: productoDePrueba() } },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    pintar();
    await screen.findByRole('heading', { name: 'Laptop HP 15' });

    await userEvent.click(screen.getByRole('button', { name: 'Aumentar cantidad' }));
    await userEvent.click(screen.getByRole('button', { name: 'Agregar al carrito' }));

    expect(JSON.parse(localStorage.getItem(CART_KEY) || '[]')).toEqual([
      { producto_id: 1, slug: 'laptop-hp-15', cantidad: 2 },
    ]);
    expect(ubicacionActual()).toBe('/market/carrito');

    // El carrito sigue vivo tras el cambio de ruta: la SPA no recarga el documento.
    expect(await screen.findByText('Laptop HP 15')).toBeInTheDocument();
    expect(document.querySelector('[data-cart-count]')?.textContent).toBe('2');
  });

  it('ofrece el mensaje de producto inválido cuando falta el slug', async () => {
    const { fetchStub } = crearFetch();
    vi.stubGlobal('fetch', fetchStub);

    pintar('/market/producto');

    expect(await screen.findByText('Producto inválido')).toBeInTheDocument();
    expect(screen.getByText(/No se indicó el producto/)).toBeInTheDocument();
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('muestra el estado de agotado cuando el stock es cero', async () => {
    const { fetchStub } = crearFetch([
      {
        coincidir: '/api/productos/laptop-hp-15',
        datos: { ok: true, producto: productoDePrueba({ stock: 0 }) },
      },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    pintar();
    await screen.findByRole('heading', { name: 'Laptop HP 15' });

    expect(screen.getByText('Agotado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Producto agotado' })).toBeDisabled();
  });
});
