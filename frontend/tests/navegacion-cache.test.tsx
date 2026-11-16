import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CART_KEY } from '../src/state/cart';
import { crearFetch, pintarApp, productoDePrueba, type Llamada } from './ayudas';

const cuenta = (llamadas: Llamada[], url: string) => llamadas.filter((llamada) => llamada.url === url).length;

function montar(producto = productoDePrueba()) {
  const detalle = { ok: true, producto };
  const reglas = crearFetch([
    { coincidir: '/api/categorias', datos: { ok: true, categorias: [{ id: 1, nombre: 'Laptops', slug: 'laptops', parent_id: null }] } },
    { coincidir: '/api/productos/laptop-hp-15', datos: detalle },
    { coincidir: '/api/productos', datos: { ok: true, productos: [producto] } },
    { coincidir: '/api/pedidos', datos: { ok: true, pedido: { numero_pedido: 'HG-1', total: '1', estado: 'pendiente' } } },
    { coincidir: '/api/pagos/configuracion', datos: { ok: true, habilitada: false } },
  ]);
  vi.stubGlobal('fetch', reglas.fetchStub);
  return { ...reglas, detalle };
}

describe('Caché y navegación', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('no vuelve a pedir catálogo ni detalle al ir y volver entre catálogo y producto', async () => {
    const { llamadas } = montar();
    pintarApp('/market');
    await screen.findByText('Laptop HP 15');

    await userEvent.click(screen.getByRole('link', { name: 'Ver producto' }));
    await screen.findByRole('heading', { name: 'Laptop HP 15' });
    await userEvent.click(screen.getByRole('link', { name: /volver al market/i }));

    // El catálogo aparece al instante, sin pantalla de carga.
    expect(screen.getByText('Laptop HP 15')).toBeInTheDocument();
    expect(screen.getByText('1 de 1 producto')).toBeVisible();
    await userEvent.click(screen.getByRole('link', { name: 'Ver producto' }));
    expect(screen.getByRole('heading', { name: 'Laptop HP 15' })).toBeInTheDocument();

    expect(cuenta(llamadas, '/api/categorias')).toBe(1);
    expect(cuenta(llamadas, '/api/productos')).toBe(1);
    expect(cuenta(llamadas, '/api/productos/laptop-hp-15')).toBe(1);
  });

  it('conserva búsqueda y categoría al volver desde un producto', async () => {
    montar();
    pintarApp('/market');
    await screen.findByText('Laptop HP 15');
    await userEvent.type(screen.getByRole('searchbox'), 'laptop');

    await userEvent.click(screen.getByRole('link', { name: 'Ver producto' }));
    await screen.findByRole('heading', { name: 'Laptop HP 15' });
    await userEvent.click(screen.getByRole('link', { name: /volver al market/i }));

    expect(screen.getByRole('searchbox')).toHaveValue('laptop');
  });

  it('el carrito y el checkout consultan SIEMPRE la red aunque el producto esté en caché', async () => {
    const { llamadas } = montar();
    pintarApp('/market/producto/laptop-hp-15');
    await screen.findByRole('heading', { name: 'Laptop HP 15' });
    expect(cuenta(llamadas, '/api/productos/laptop-hp-15')).toBe(1);

    await userEvent.click(screen.getByRole('button', { name: 'Agregar al carrito' }));
    await screen.findByText(/Subtotal: S\//);
    expect(cuenta(llamadas, '/api/productos/laptop-hp-15')).toBe(2);

    await userEvent.click(screen.getByRole('button', { name: 'Finalizar compra' }));
    await screen.findByLabelText(/correo electrónico/i);
    expect(cuenta(llamadas, '/api/productos/laptop-hp-15')).toBe(3);
  });

  it('no permite comprar con stock viejo: si el producto se agotó tras cachearse, el carrito lo bloquea', async () => {
    const { detalle } = montar();
    pintarApp('/market/producto/laptop-hp-15');
    await screen.findByRole('heading', { name: 'Laptop HP 15' });

    // El stock real cambió en el servidor mientras la vista conservaba 5 unidades.
    detalle.producto = productoDePrueba({ stock: 0 });
    await userEvent.click(screen.getByRole('button', { name: 'Agregar al carrito' }));

    expect(await screen.findByText('Agotado')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Finalizar compra' })).toBeDisabled());
  });

  it('con datos en caché el carrito se pinta al instante pero bloquea el pago hasta validar con el servidor', async () => {
    montar();
    pintarApp('/market/producto/laptop-hp-15');
    await screen.findByRole('heading', { name: 'Laptop HP 15' });
    await userEvent.click(screen.getByRole('button', { name: 'Agregar al carrito' }));

    expect(await screen.findByText('Laptop HP 15')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Finalizar compra' })).toBeEnabled());
  });

  it('descarta la caché al registrar un pedido para no mostrar stock antiguo', async () => {
    const { llamadas } = montar();
    localStorage.setItem(CART_KEY, JSON.stringify([{ producto_id: 1, slug: 'laptop-hp-15', cantidad: 1 }]));
    pintarApp('/market');
    await screen.findByText('Laptop HP 15');
    expect(cuenta(llamadas, '/api/productos')).toBe(1);

    await userEvent.click(screen.getByRole('link', { name: /^carrito \(/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Finalizar compra' }));
    await userEvent.type(await screen.findByLabelText(/correo electrónico/i), 'ana@horus.test');
    await userEvent.type(screen.getByLabelText(/nombre y apellidos/i), 'Ana Torres');
    await userEvent.type(screen.getByLabelText(/^teléfono/i), '999888777');
    await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
    for (const [etiqueta, valor] of [[/^departamento/i, 'Lima'], [/^provincia/i, 'Lima'], [/^distrito/i, 'Miraflores'], [/^dirección$/i, 'Av. 1']] as const) {
      await userEvent.type(screen.getByLabelText(etiqueta), valor);
    }
    await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
    await userEvent.type(screen.getByLabelText(/^dni/i), '45678912');
    await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
    await userEvent.click(screen.getByLabelText(/he revisado los datos/i));
    await userEvent.click(screen.getByRole('button', { name: /registrar pedido y continuar/i }));
    await screen.findByText(/Gracias por tu compra/);

    await userEvent.click(screen.getByRole('link', { name: /volver al catálogo/i }));
    await screen.findByText('Laptop HP 15');
    await waitFor(() => expect(cuenta(llamadas, '/api/productos')).toBe(2));
  });
});
