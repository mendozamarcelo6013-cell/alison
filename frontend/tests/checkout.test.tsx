import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutPage } from '../src/pages/CheckoutPage';
import { CartProvider } from '../src/state/CartContext';
import { CART_KEY } from '../src/state/cart';
import { cuerpoJson, crearFetch, llamadaPorUrl, productoDePrueba } from './ayudas';
import type { PayloadPedido } from '../src/types';

vi.mock('../src/utils/navigation', () => ({ irA: vi.fn() }));

const CLAVE_ULTIMO_PEDIDO = 'horus_market_last_order';

const PEDIDO = {
  numero_pedido: 'HG-2026-0001',
  estado: 'pendiente',
  subtotal: '4999.80',
  igv_total: '899.96',
  envio_total: '0',
  total: '4999.80',
  moneda: 'PEN',
};

function pintar() {
  return render(
    <CartProvider>
      <CheckoutPage />
    </CartProvider>,
  );
}

async function rellenarFormulario() {
  await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'ana@horus.test');
  await userEvent.type(screen.getByLabelText(/nombre y apellidos/i), 'Ana Torres');
  await userEvent.type(screen.getByLabelText(/^teléfono/i), '999888777');
  await userEvent.type(screen.getByLabelText(/^departamento/i), 'Lima');
  await userEvent.type(screen.getByLabelText(/^provincia/i), 'Lima');
  await userEvent.type(screen.getByLabelText(/^distrito/i), 'Miraflores');
  await userEvent.type(screen.getByLabelText(/^dirección$/i), 'Av. Principal 123');
  await userEvent.type(screen.getByLabelText(/^notas para el pedido/i), 'Llamar antes de llegar.');
  await userEvent.click(screen.getByLabelText(/he revisado los datos/i));
}

describe('Checkout', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(CART_KEY, JSON.stringify([{ producto_id: 1, slug: 'laptop-hp-15', cantidad: 2 }]));
  });

  it('valida el carrito, muestra el resumen y pide dirección por ser producto físico', async () => {
    const { fetchStub } = crearFetch([
      { coincidir: '/api/productos/laptop-hp-15', datos: { ok: true, producto: productoDePrueba() } },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    pintar();

    expect(await screen.findByText('Laptop HP 15')).toBeInTheDocument();
    expect(screen.getByText('Cantidad: 2')).toBeInTheDocument();
    expect(screen.getByText('S/ 4999.80', { selector: '#order-total' })).toBeInTheDocument();
    expect(screen.getByText(/tu pedido incluye productos físicos/i)).toBeInTheDocument();
    expect(screen.getByText(/la necesitamos porque tu pedido/i)).toBeVisible();
  });

  it('crea el pedido con items mínimos y guarda horus_market_last_order', async () => {
    const { fetchStub, llamadas } = crearFetch([
      { coincidir: '/api/productos/laptop-hp-15', datos: { ok: true, producto: productoDePrueba() } },
      { coincidir: '/api/pedidos', datos: { ok: true, pedido: PEDIDO } },
      { coincidir: '/api/pagos/configuracion', datos: { ok: true, habilitada: false, proveedor: null } },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    pintar();
    await screen.findByText('Laptop HP 15');
    await rellenarFormulario();

    await userEvent.click(screen.getByRole('button', { name: /registrar pedido y continuar/i }));

    expect(await screen.findByText(/Tu pedido HG-2026-0001 fue registrado/)).toBeInTheDocument();

    const peticion = llamadaPorUrl(llamadas, '/api/pedidos');
    expect(peticion).toBeDefined();
    expect(peticion?.init?.method).toBe('POST');

    const payload = cuerpoJson<PayloadPedido>(peticion);
    expect(payload.items).toEqual([{ slug: 'laptop-hp-15', cantidad: 2 }]);
    expect(payload.email).toBe('ana@horus.test');
    expect(payload.destinatario).toBe('Ana Torres');
    expect(payload.telefono).toBe('999888777');
    expect(payload.notas).toBe('Llamar antes de llegar.');
    expect(payload.direccion).toEqual({
      departamento: 'Lima',
      provincia: 'Lima',
      distrito: 'Miraflores',
      direccion_linea1: 'Av. Principal 123',
      referencia: '',
    });
    expect(payload).not.toHaveProperty('items.0.nombre');

    expect(JSON.parse(sessionStorage.getItem(CLAVE_ULTIMO_PEDIDO) || '{}')).toEqual(PEDIDO);
    expect(JSON.parse(localStorage.getItem(CART_KEY) || '[]')).toEqual([]);
    expect(screen.getByRole('button', { name: 'Pagar en línea (por configurar)' })).toBeDisabled();
  });

  it('omite la dirección cuando el pedido no incluye productos físicos', async () => {
    localStorage.setItem(CART_KEY, JSON.stringify([{ producto_id: 3, slug: 'consultoria', cantidad: 1 }]));
    const { fetchStub, llamadas } = crearFetch([
      {
        coincidir: '/api/productos/consultoria',
        datos: { ok: true, producto: productoDePrueba({ id: 3, slug: 'consultoria', nombre: 'Consultoría', tipo: 'servicio' }) },
      },
      { coincidir: '/api/pedidos', datos: { ok: true, pedido: { ...PEDIDO, numero_pedido: 'HG-2026-0002' } } },
      { coincidir: '/api/pagos/configuracion', datos: { ok: true, habilitada: false, proveedor: null } },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    pintar();
    await screen.findByText('Consultoría');

    expect(screen.getByText(/dirección de entrega/i).closest('section')).not.toBeVisible();
    expect(screen.getByLabelText(/^departamento/i)).not.toBeVisible();

    await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'ana@horus.test');
    await userEvent.type(screen.getByLabelText(/nombre y apellidos/i), 'Ana Torres');
    await userEvent.type(screen.getByLabelText(/^teléfono/i), '999888777');
    await userEvent.click(screen.getByLabelText(/he revisado los datos/i));
    await userEvent.click(screen.getByRole('button', { name: /registrar pedido y continuar/i }));

    expect(await screen.findByText(/Tu pedido HG-2026-0002 fue registrado/)).toBeInTheDocument();
    const payload = cuerpoJson<PayloadPedido>(llamadaPorUrl(llamadas, '/api/pedidos'));
    expect(payload).not.toHaveProperty('direccion');
  });

  it('bloquea el pedido cuando el stock ya no alcanza', async () => {
    const { fetchStub, llamadas } = crearFetch([
      {
        coincidir: '/api/productos/laptop-hp-15',
        datos: { ok: true, producto: productoDePrueba({ stock: 1 }) },
      },
      { coincidir: '/api/pedidos', datos: { ok: true, pedido: PEDIDO } },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    pintar();

    expect(
      await screen.findByText('La cantidad seleccionada ya no está disponible para Laptop HP 15. Regresa al carrito para actualizarlo.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /registrar pedido y continuar/i })).not.toBeInTheDocument();
    expect(llamadas.some((llamada) => llamada.url === '/api/pedidos')).toBe(false);
  });
});
