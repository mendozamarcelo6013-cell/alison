import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogoPage } from '../src/pages/CatalogoPage';
import { CartProvider } from '../src/state/CartContext';
import { crearFetch, productoDePrueba } from './ayudas';

function pintar() {
  return render(
    <CartProvider>
      <CatalogoPage />
    </CartProvider>,
  );
}

const CATEGORIAS = {
  ok: true,
  categorias: [
    { id: 1, nombre: 'Laptops', slug: 'laptops', activa: true },
    { id: 2, nombre: 'Accesorios', slug: 'accesorios', activa: true },
  ],
};

const PRODUCTOS = {
  ok: true,
  productos: [
    productoDePrueba(),
    productoDePrueba({
      id: 2,
      nombre: 'Mouse Inalámbrico',
      slug: 'mouse-inalambrico',
      precio: '89.50',
      stock: 12,
      categoria: { id: 2, nombre: 'Accesorios', slug: 'accesorios' },
    }),
  ],
};

describe('Catálogo', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('muestra los productos y precios devueltos por la API', async () => {
    const { fetchStub } = crearFetch([
      { coincidir: '/api/categorias', datos: CATEGORIAS },
      { coincidir: '/api/productos', datos: PRODUCTOS },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    pintar();

    expect(await screen.findByText('Laptop HP 15')).toBeInTheDocument();
    expect(screen.getByText('Mouse Inalámbrico')).toBeInTheDocument();
    expect(screen.getByText('S/ 2499.90')).toBeInTheDocument();
    expect(screen.getByText('S/ 89.50')).toBeInTheDocument();
    expect(screen.getByText('2 de 2 productos')).toBeInTheDocument();
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('filtra por categoría sin volver a consultar la API', async () => {
    const { fetchStub } = crearFetch([
      { coincidir: '/api/categorias', datos: CATEGORIAS },
      { coincidir: '/api/productos', datos: PRODUCTOS },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    pintar();
    await screen.findByText('Laptop HP 15');
    const peticionesTrasCarga = fetchStub.mock.calls.length;

    await userEvent.click(screen.getByRole('button', { name: 'Accesorios' }));

    expect(screen.queryByText('Laptop HP 15')).not.toBeInTheDocument();
    expect(screen.getByText('Mouse Inalámbrico')).toBeInTheDocument();
    expect(screen.getByText('1 de 2 productos')).toBeInTheDocument();
    expect(fetchStub.mock.calls.length).toBe(peticionesTrasCarga);
  });

  it('filtra por búsqueda local y muestra el estado vacío', async () => {
    const { fetchStub } = crearFetch([
      { coincidir: '/api/categorias', datos: { ok: true, categorias: [] } },
      { coincidir: '/api/productos', datos: { ok: true, productos: [productoDePrueba()] } },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    pintar();
    await screen.findByText('Laptop HP 15');

    await userEvent.type(screen.getByRole('searchbox'), 'zzzz');

    expect(await screen.findByText('No encontramos productos con esos filtros.')).toBeInTheDocument();
    expect(screen.queryByText('Laptop HP 15')).not.toBeInTheDocument();
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });
});
