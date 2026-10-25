import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CART_KEY, guardarCarrito, normalizarCarrito } from '../src/state/cart';
import { crearFetch, pintarApp, productoDePrueba } from './ayudas';

function pintar() {
  return pintarApp('/market/carrito');
}

function sembrar(items: unknown) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

describe('Persistencia del carrito', () => {
  beforeEach(() => localStorage.clear());

  it('usa exactamente la clave horus_market_cart', () => {
    sembrar([{ producto_id: 7, slug: 'teclado', cantidad: 1 }]);
    expect(Object.keys(localStorage)).toEqual(['horus_market_cart']);
  });

  it('normaliza, descarta inválidos y fusiona duplicados por slug', () => {
    const resultado = normalizarCarrito([
      { producto_id: 7, slug: 'teclado', cantidad: 2 },
      { producto_id: 7, slug: 'teclado', cantidad: 3 },
      { producto_id: 0, slug: 'invalido', cantidad: 1 },
      { producto_id: 9, slug: '', cantidad: 1 },
      { producto_id: 9, slug: 'mouse', cantidad: 0 },
      'no-objeto',
      null,
    ]);

    expect(resultado).toEqual([
      { producto_id: 7, slug: 'teclado', cantidad: 5 },
      { producto_id: 9, slug: 'mouse', cantidad: 1 },
    ]);
  });

  it('guarda una copia normalizada sin nombres ni precios definitivos', () => {
    const guardados = guardarCarrito([
      { producto_id: 7, slug: 'teclado', cantidad: 2, nombre: 'Teclado', precio: 100 },
    ]);

    expect(guardados).toEqual([{ producto_id: 7, slug: 'teclado', cantidad: 2 }]);
    const almacenado = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    expect(almacenado[0]).not.toHaveProperty('nombre');
    expect(almacenado[0]).not.toHaveProperty('precio');
  });

  it('devuelve carrito vacío si el contenido guardado no es JSON válido', () => {
    localStorage.setItem(CART_KEY, '{esto no es json');
    expect(normalizarCarrito(null)).toEqual([]);
  });
});

describe('Página de carrito', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('valida cada item contra la API y calcula el subtotal con el precio del servidor', async () => {
    sembrar([{ producto_id: 1, slug: 'laptop-hp-15', cantidad: 2 }]);
    const { fetchStub, llamadas } = crearFetch([
      { coincidir: '/api/productos/laptop-hp-15', datos: { ok: true, producto: productoDePrueba() } },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    pintar();

    expect(await screen.findByText('Laptop HP 15')).toBeInTheDocument();
    expect(llamadas[0].url).toBe('/api/productos/laptop-hp-15');
    expect(screen.getByText('Stock disponible: 5 unidades')).toBeInTheDocument();
    expect(screen.getByText('Subtotal: S/ 4999.80')).toBeInTheDocument();
    expect(screen.getByText('S/ 4999.80')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finalizar compra' })).toBeEnabled();
  });

  it('al subir la cantidad actualiza localStorage y el resumen', async () => {
    sembrar([{ producto_id: 1, slug: 'laptop-hp-15', cantidad: 2 }]);
    const { fetchStub } = crearFetch([
      { coincidir: '/api/productos/laptop-hp-15', datos: { ok: true, producto: productoDePrueba() } },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    pintar();
    await screen.findByText('Laptop HP 15');

    await userEvent.click(screen.getByRole('button', { name: 'Aumentar cantidad' }));

    expect(JSON.parse(localStorage.getItem(CART_KEY) || '[]')).toEqual([
      { producto_id: 1, slug: 'laptop-hp-15', cantidad: 3 },
    ]);
    expect(screen.getByText('Subtotal: S/ 7499.70')).toBeInTheDocument();
    expect(document.querySelector('[data-cart-count]')?.textContent).toBe('3');
  });

  it('marca como no disponible un producto que ya no existe y bloquea el checkout', async () => {
    sembrar([{ producto_id: 1, slug: 'borrado', cantidad: 1 }]);
    const { fetchStub } = crearFetch([
      { coincidir: '/api/productos/borrado', datos: { ok: false, mensaje: 'No encontrado' }, status: 404 },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    pintar();

    expect(await screen.findByText('Producto no disponible')).toBeInTheDocument();
    expect(screen.getByText('Este producto ya no existe o está inactivo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finalizar compra' })).toBeDisabled();
  });

  it('muestra el estado vacío cuando no hay nada guardado', async () => {
    const { fetchStub } = crearFetch();
    vi.stubGlobal('fetch', fetchStub);

    pintar();

    expect(await screen.findByText('Tu carrito está vacío')).toBeInTheDocument();
    expect(fetchStub).not.toHaveBeenCalled();
  });
});

describe('Carrito: experiencia', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('eliminar un producto no vuelve a consultar la red ni oculta el resto del carrito', async () => {
    sembrar([
      { producto_id: 1, slug: 'laptop-hp-15', cantidad: 1 },
      { producto_id: 2, slug: 'mouse', cantidad: 1 },
    ]);
    const { fetchStub, llamadas } = crearFetch([
      { coincidir: '/api/productos/laptop-hp-15', datos: { ok: true, producto: productoDePrueba() } },
      { coincidir: '/api/productos/mouse', datos: { ok: true, producto: productoDePrueba({ id: 2, nombre: 'Mouse', slug: 'mouse', precio: '50.00' }) } },
    ]);
    vi.stubGlobal('fetch', fetchStub);
    pintar();
    await screen.findByText('Mouse');
    const antes = llamadas.length;

    await userEvent.click(screen.getByRole('button', { name: /eliminar laptop hp 15/i }));

    expect(screen.queryByText('Laptop HP 15')).not.toBeInTheDocument();
    expect(screen.getByText('Mouse')).toBeInTheDocument();
    expect(llamadas).toHaveLength(antes);
    expect(JSON.parse(localStorage.getItem(CART_KEY) || '[]')).toEqual([{ producto_id: 2, slug: 'mouse', cantidad: 1 }]);

    await userEvent.click(screen.getByRole('button', { name: /eliminar mouse/i }));
    expect(screen.getByText('Tu carrito está vacío')).toBeVisible();
  });

  it('avisa cuando la cantidad guardada excede el stock y la ajusta', async () => {
    sembrar([{ producto_id: 1, slug: 'laptop-hp-15', cantidad: 9 }]);
    const { fetchStub } = crearFetch([
      { coincidir: '/api/productos/laptop-hp-15', datos: { ok: true, producto: productoDePrueba({ stock: 3 }) } },
    ]);
    vi.stubGlobal('fetch', fetchStub);
    pintar();

    expect(await screen.findByText(/Ajustamos la cantidad a 3 unidades/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(CART_KEY) || '[]')[0].cantidad).toBe(3);
    expect(screen.getByText('Alcanzaste el máximo disponible.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aumentar cantidad' })).toBeDisabled();
  });

  it('un producto agotado explica qué hacer y bloquea el pago', async () => {
    sembrar([{ producto_id: 1, slug: 'laptop-hp-15', cantidad: 1 }]);
    const { fetchStub } = crearFetch([
      { coincidir: '/api/productos/laptop-hp-15', datos: { ok: true, producto: productoDePrueba({ stock: 0 }) } },
    ]);
    vi.stubGlobal('fetch', fetchStub);
    pintar();

    expect(await screen.findByText(/Este producto se agotó/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finalizar compra' })).toBeDisabled();
  });

  it('si no se pudo validar, ofrece reintentar y el checkout sigue bloqueado', async () => {
    sembrar([{ producto_id: 1, slug: 'laptop-hp-15', cantidad: 1 }]);
    const reglas = [{ coincidir: '/api/productos/laptop-hp-15', status: 500, datos: { ok: false, mensaje: 'Error' } }];
    const { fetchStub } = crearFetch(reglas);
    vi.stubGlobal('fetch', fetchStub);
    pintar();

    expect(await screen.findByText(/Algunos productos no pudieron validarse/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Finalizar compra' })).toBeDisabled();

    reglas[0].status = 200;
    (reglas[0] as { datos: unknown }).datos = { ok: true, producto: productoDePrueba() };
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Finalizar compra' })).toBeEnabled());
  });
});
