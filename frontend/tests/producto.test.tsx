import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductoPage } from '../src/pages/ProductoPage';
import { CartProvider } from '../src/state/CartContext';
import { CART_KEY } from '../src/state/cart';
import { irA } from '../src/utils/navigation';
import { crearFetch, productoDePrueba } from './ayudas';

vi.mock('../src/utils/navigation', () => ({ irA: vi.fn() }));

function pintar() {
  return render(
    <CartProvider>
      <ProductoPage />
    </CartProvider>,
  );
}

function situar(ruta: string) {
  window.history.replaceState({}, '', ruta);
}

describe('Detalle de producto', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    situar('/market-producto.html?slug=laptop-hp-15');
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
    expect(await screen.findByText('Producto agregado. Abriendo tu carrito…')).toBeInTheDocument();
    expect(document.querySelector('[data-cart-count]')?.textContent).toBe('2');
    expect(irA).toHaveBeenCalledWith('/market-carrito.html');
  });

  it('ofrece el mensaje de producto inválido cuando falta el slug', async () => {
    situar('/market-producto.html');
    const { fetchStub } = crearFetch();
    vi.stubGlobal('fetch', fetchStub);

    pintar();

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
