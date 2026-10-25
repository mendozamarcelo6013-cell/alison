import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearFetch, pintarApp, productoDePrueba } from './ayudas';

describe('Catálogo: estados', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('identifica los productos agotados y no los presenta como disponibles', async () => {
    const { fetchStub } = crearFetch([
      { coincidir: '/api/categorias', datos: { ok: true, categorias: [] } },
      {
        coincidir: '/api/productos',
        datos: {
          ok: true,
          productos: [
            productoDePrueba({ id: 1, nombre: 'Laptop HP 15', slug: 'laptop-hp-15', stock: 0 }),
            productoDePrueba({ id: 2, nombre: 'Mouse', slug: 'mouse', stock: 3 }),
            productoDePrueba({ id: 3, nombre: 'Consultoría', slug: 'consultoria', stock: 0, controla_stock: false }),
          ],
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchStub);
    pintarApp('/market');
    await screen.findByText('Laptop HP 15');

    const agotada = screen.getByText('Laptop HP 15').closest('article') as HTMLElement;
    expect(agotada).toHaveClass('is-agotado');
    expect(within(agotada).getByText('Agotado')).toBeInTheDocument();
    expect(within(agotada).queryByText(/^Stock: /)).not.toBeInTheDocument();

    const disponible = screen.getByText('Mouse').closest('article') as HTMLElement;
    expect(disponible).not.toHaveClass('is-agotado');
    expect(within(disponible).getByText('Stock: 3 unidades')).toHaveClass('stock-bajo');

    // Sin control de stock nunca se marca como agotado.
    const servicio = screen.getByText('Consultoría').closest('article') as HTMLElement;
    expect(servicio).not.toHaveClass('is-agotado');
    expect(within(servicio).getByText('Disponible')).toBeInTheDocument();
  });

  it('muestra esqueletos mientras carga y un error con botón de reintento', async () => {
    let fallar = true;
    const { fetchStub } = crearFetch([
      { coincidir: '/api/categorias', datos: { ok: true, categorias: [] } },
      { coincidir: '/api/productos', datos: { ok: true, productos: [productoDePrueba()] } },
    ]);
    vi.stubGlobal('fetch', vi.fn((entrada: RequestInfo | URL, init?: RequestInit) => (
      fallar ? Promise.reject(new Error('sin red')) : fetchStub(entrada, init)
    )));

    pintarApp('/market');
    expect(document.querySelectorAll('.product-card-skeleton').length).toBeGreaterThan(0);
    expect(await screen.findByText('No se pudo conectar con el servidor.')).toBeVisible();

    fallar = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Laptop HP 15')).toBeInTheDocument();
    expect(document.querySelectorAll('.product-card-skeleton')).toHaveLength(0);
  });

  it('el panel de categorías se puede plegar y expone su estado', async () => {
    const { fetchStub } = crearFetch([
      { coincidir: '/api/categorias', datos: { ok: true, categorias: [{ id: 1, nombre: 'Laptops', slug: 'laptops', parent_id: null }] } },
      { coincidir: '/api/productos', datos: { ok: true, productos: [productoDePrueba()] } },
    ]);
    vi.stubGlobal('fetch', fetchStub);
    pintarApp('/market');
    await screen.findByText('Laptop HP 15');

    const alternar = screen.getByRole('button', { name: /filtrar por categoría/i });
    expect(alternar).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(alternar);
    expect(alternar).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Laptops' }));
    expect(alternar).toHaveAttribute('aria-expanded', 'false');
    expect(alternar).toHaveTextContent('Laptops');
  });
});
