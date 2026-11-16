import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CART_KEY } from '../src/state/cart';
import { cuerpoJson, crearFetch, llamadaPorUrl, pintarApp, productoDePrueba } from './ayudas';
import type { PayloadPedido } from '../src/types';

// `irA` sólo se usa para saltar al proveedor de pago externo (navegación completa).
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
  return pintarApp('/market/checkout');
}

const continuar = () => userEvent.click(screen.getByRole('button', { name: /continuar/i }));

async function rellenarContacto() {
  await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'ana@horus.test');
  await userEvent.type(screen.getByLabelText(/nombre y apellidos/i), 'Ana Torres');
  await userEvent.type(screen.getByLabelText(/^teléfono/i), '999888777');
  await continuar();
}

async function rellenarEntrega() {
  await userEvent.type(screen.getByLabelText(/^departamento/i), 'Lima');
  await userEvent.type(screen.getByLabelText(/^provincia/i), 'Lima');
  await userEvent.type(screen.getByLabelText(/^distrito/i), 'Miraflores');
  await userEvent.type(screen.getByLabelText(/^dirección$/i), 'Av. Principal 123');
  await continuar();
}

async function rellenarBoleta(dni = '45678912') {
  await userEvent.type(screen.getByLabelText(/^dni/i), dni);
  await continuar();
}

/** Recorre contacto → entrega → comprobante (boleta) hasta la confirmación. */
async function rellenarFormulario({ fisico = true } = {}) {
  await rellenarContacto();
  if (fisico) await rellenarEntrega();
  await rellenarBoleta();
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
    expect(screen.getByRole('navigation', { name: /progreso del pedido/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Datos de contacto' })).toBeInTheDocument();
    expect(screen.getByText('Paso 1 de 4')).toBeInTheDocument();

    await rellenarContacto();
    expect(screen.getByRole('heading', { name: 'Método de entrega' })).toBeInTheDocument();
    expect(screen.getByText(/la necesitamos porque tu pedido/i)).toBeVisible();
    expect(screen.getByLabelText(/^departamento/i)).toBeVisible();
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
    expect(payload.tipo_comprobante).toBe('boleta');
    expect(payload.dni_boleta).toBe('45678912');
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

    // Sin productos físicos el paso de entrega no existe.
    expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument();
    expect(screen.queryByText(/método de entrega/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^departamento/i)).not.toBeInTheDocument();

    await rellenarFormulario({ fisico: false });
    expect(screen.queryByLabelText(/^departamento/i)).not.toBeInTheDocument();
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

describe('Checkout por pasos', () => {
  const montar = (extra: Parameters<typeof crearFetch>[0] = []) => {
    const reglas = crearFetch([
      { coincidir: '/api/productos/laptop-hp-15', datos: { ok: true, producto: productoDePrueba() } },
      { coincidir: '/api/pagos/configuracion', datos: { ok: true, habilitada: false, proveedor: null } },
      ...extra,
    ]);
    vi.stubGlobal('fetch', reglas.fetchStub);
    return reglas;
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(CART_KEY, JSON.stringify([{ producto_id: 1, slug: 'laptop-hp-15', cantidad: 2 }]));
  });

  it('no avanza con campos vacíos: muestra errores accesibles y enfoca el primero', async () => {
    montar();
    pintar();
    await screen.findByLabelText(/correo electrónico/i);

    await continuar();

    expect(screen.getByRole('heading', { name: 'Datos de contacto' })).toBeInTheDocument();
    const alertas = screen.getAllByRole('alert').map((alerta) => alerta.textContent);
    expect(alertas).toEqual(expect.arrayContaining([
      'Ingresa tu correo electrónico.',
      'Ingresa tu nombre y apellidos.',
      'Ingresa un número de contacto.',
    ]));
    const correo = screen.getByLabelText(/correo electrónico/i);
    expect(correo).toHaveAttribute('aria-invalid', 'true');
    expect(correo).toHaveAccessibleDescription('Ingresa tu correo electrónico.');
    expect(correo).toHaveFocus();

    await userEvent.type(correo, 'ana@horus.test');
    expect(correo).not.toHaveAttribute('aria-invalid');
  });

  it('marca el progreso y permite retroceder sin perder los datos escritos', async () => {
    montar();
    pintar();
    await screen.findByLabelText(/correo electrónico/i);
    const progreso = screen.getByRole('navigation', { name: /progreso del pedido/i });
    expect(within(progreso).getAllByRole('listitem')).toHaveLength(4);
    expect(within(progreso).getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step');

    await rellenarContacto();
    await userEvent.type(screen.getByLabelText(/^departamento/i), 'Lima');
    expect(within(progreso).getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step');

    await userEvent.click(screen.getByRole('button', { name: /atrás/i }));
    expect(screen.getByLabelText(/correo electrónico/i)).toHaveValue('ana@horus.test');
    expect(screen.getByLabelText(/^teléfono/i)).toHaveValue('999888777');

    await continuar();
    expect(screen.getByLabelText(/^departamento/i)).toHaveValue('Lima');
  });

  it('recojo en tienda: no pide dirección, muestra la tienda y no la envía', async () => {
    const { llamadas } = montar([{ coincidir: '/api/pedidos', datos: { ok: true, pedido: { ...PEDIDO, metodo_entrega: 'recojo_tienda' } } }]);
    pintar();
    await screen.findByLabelText(/correo electrónico/i);
    await rellenarContacto();

    await userEvent.click(screen.getByLabelText(/recojo en tienda/i));
    expect(screen.queryByLabelText(/^departamento/i)).not.toBeInTheDocument();
    expect(screen.getByText(/costo de recojo: s\/ 0\.00/i)).toBeInTheDocument();
    expect(screen.getByText('Cuadra 2 de Av. Independencia')).toBeInTheDocument();
    expect(screen.getByText('Lunes a viernes de 3:00 p. m. a 6:00 p. m.')).toBeInTheDocument();
    await continuar();
    await rellenarBoleta();
    await userEvent.click(screen.getByLabelText(/he revisado los datos/i));
    await userEvent.click(screen.getByRole('button', { name: /registrar pedido y continuar/i }));
    await screen.findByText(/Tu pedido HG-2026-0001 fue registrado/);

    const payload = cuerpoJson<PayloadPedido>(llamadaPorUrl(llamadas, '/api/pedidos'));
    expect(payload.metodo_entrega).toBe('recojo_tienda');
    expect(payload).not.toHaveProperty('direccion');
  });

  it('factura: exige RUC de 11 dígitos, razón social y dirección fiscal, y los envía', async () => {
    const { llamadas } = montar([{ coincidir: '/api/pedidos', datos: { ok: true, pedido: PEDIDO } }]);
    pintar();
    await screen.findByLabelText(/correo electrónico/i);
    await rellenarContacto();
    await rellenarEntrega();

    expect(screen.queryByLabelText(/^ruc/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/^factura/i));
    await userEvent.type(screen.getByLabelText(/^ruc/i), '2012');
    await continuar();
    expect(screen.getByText('El RUC debe tener 11 dígitos.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa la razón social.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/^ruc/i), '3456789');
    await userEvent.type(screen.getByLabelText(/razón social/i), 'Empresa SAC');
    await userEvent.type(screen.getByLabelText(/dirección fiscal/i), 'Av. Fiscal 1');
    await continuar();
    await userEvent.click(screen.getByLabelText(/he revisado los datos/i));
    await userEvent.click(screen.getByRole('button', { name: /registrar pedido y continuar/i }));
    await screen.findByText(/Tu pedido HG-2026-0001 fue registrado/);

    const payload = cuerpoJson<PayloadPedido>(llamadaPorUrl(llamadas, '/api/pedidos'));
    expect(payload).toMatchObject({
      tipo_comprobante: 'factura',
      ruc_factura: '20123456789',
      razon_social_factura: 'Empresa SAC',
      direccion_factura: 'Av. Fiscal 1',
    });
    expect(payload).not.toHaveProperty('dni_boleta');
  });

  it('RUC: acepta sólo dígitos, nunca más de 11, y no deja continuar con menos', async () => {
    montar();
    pintar();
    await screen.findByLabelText(/correo electrónico/i);
    await rellenarContacto();
    await rellenarEntrega();
    await userEvent.click(screen.getByLabelText(/^factura/i));

    const ruc = screen.getByLabelText(/^ruc/i);
    await userEvent.type(ruc, '20-1234-5678-9012');
    expect(ruc).toHaveValue('20123456789');
    expect(screen.getByText('11 de 11 dígitos')).toBeInTheDocument();

    await userEvent.clear(ruc);
    await userEvent.type(ruc, '2012345678');
    expect(screen.getByText('10 de 11 dígitos')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/razón social/i), 'Empresa SAC');
    await userEvent.type(screen.getByLabelText(/dirección fiscal/i), 'Av. Fiscal 1');
    await continuar();
    expect(screen.getByRole('heading', { name: 'Comprobante' })).toBeInTheDocument();
    expect(ruc).toHaveAccessibleDescription(expect.stringContaining('El RUC debe tener 11 dígitos.'));
    expect(ruc).toHaveFocus();
  });

  it('boleta: exige DNI de 8 dígitos y lo muestra debajo del cliente en el comprobante', async () => {
    const { llamadas } = montar([{
      coincidir: '/api/pedidos',
      datos: { ok: true, pedido: { ...PEDIDO, tipo_comprobante: 'boleta', dni_boleta: '45678912', fecha_creacion: '2026-11-05T15:00:00Z' } },
    }]);
    pintar();
    await screen.findByLabelText(/correo electrónico/i);
    await rellenarContacto();
    await rellenarEntrega();

    const dni = screen.getByLabelText(/^dni/i);
    await userEvent.type(dni, '4567abc89123');
    expect(dni).toHaveValue('45678912');
    await userEvent.clear(dni);
    await userEvent.type(dni, '4567891');
    await continuar();
    expect(screen.getByText('El DNI debe tener 8 dígitos.')).toBeInTheDocument();

    await userEvent.type(dni, '2');
    await continuar();
    expect(screen.getByText(/Boleta · DNI 45678912/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/he revisado los datos/i));
    await userEvent.click(screen.getByRole('button', { name: /registrar pedido y continuar/i }));
    await screen.findByText(/Tu pedido HG-2026-0001 fue registrado/);

    expect(cuerpoJson<PayloadPedido>(llamadaPorUrl(llamadas, '/api/pedidos')).dni_boleta).toBe('45678912');
    const detalles = [...document.querySelectorAll('.receipt-details p')].map((p) => p.textContent);
    expect(detalles.slice(0, 2)).toEqual(['Cliente: Ana Torres', 'DNI: 45678912']);
  });

  it('factura: el resumen y el comprobante desglosan el IGV (18%)', async () => {
    montar([{
      coincidir: '/api/pedidos',
      datos: {
        ok: true,
        pedido: {
          ...PEDIDO,
          igv_total: '762.68',
          tipo_comprobante: 'factura',
          ruc_factura: '20123456789',
          razon_social_factura: 'Empresa SAC',
          direccion_factura: 'Av. Fiscal 1',
          fecha_creacion: '2026-11-05T15:00:00Z',
        },
      },
    }]);
    pintar();
    await screen.findByLabelText(/correo electrónico/i);
    await rellenarContacto();
    await rellenarEntrega();
    expect(screen.queryByLabelText(/desglose del igv/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/^factura/i));
    const resumen = screen.getByLabelText(/desglose del igv/i);
    expect(resumen).toHaveTextContent('Op. gravadaS/ 4237.12');
    expect(resumen).toHaveTextContent('IGV (18%)S/ 762.68');

    await userEvent.type(screen.getByLabelText(/^ruc/i), '20123456789');
    await userEvent.type(screen.getByLabelText(/razón social/i), 'Empresa SAC');
    await userEvent.type(screen.getByLabelText(/dirección fiscal/i), 'Av. Fiscal 1');
    await continuar();
    await userEvent.click(screen.getByLabelText(/he revisado los datos/i));
    await userEvent.click(screen.getByRole('button', { name: /registrar pedido y continuar/i }));
    await screen.findByText(/Tu pedido HG-2026-0001 fue registrado/);

    const comprobante = document.querySelector('#receipt-print .receipt-igv');
    expect(comprobante).toHaveTextContent('Op. gravadaS/ 4237.12');
    expect(comprobante).toHaveTextContent('IGV (18%)S/ 762.68');
    expect(document.querySelector('#receipt-print .receipt-total')).toHaveTextContent('S/ 4999.80');
  });

  it('la confirmación resume los datos y exige aceptar antes de registrar', async () => {
    const { llamadas } = montar([{ coincidir: '/api/pedidos', datos: { ok: true, pedido: PEDIDO } }]);
    pintar();
    await screen.findByLabelText(/correo electrónico/i);
    await rellenarFormulario();
    expect(screen.getByText(/Ana Torres · ana@horus\.test · 999888777/)).toBeInTheDocument();
    expect(screen.getByText(/Envío a domicilio · Av\. Principal 123/)).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/he revisado los datos/i)); // desmarca
    await userEvent.click(screen.getByRole('button', { name: /registrar pedido y continuar/i }));
    expect(screen.getByText(/debes confirmar que revisaste los datos/i)).toBeInTheDocument();
    expect(llamadas.some((llamada) => llamada.url === '/api/pedidos')).toBe(false);
  });

  it('evita envíos duplicados: dos clics seguidos crean un solo pedido', async () => {
    let liberar: () => void = () => {};
    const { llamadas, fetchStub } = montar([{ coincidir: '/api/pedidos', datos: { ok: true, pedido: PEDIDO } }]);
    const original = fetchStub.getMockImplementation();
    fetchStub.mockImplementation(async (entrada, init) => {
      if (String(entrada) === '/api/pedidos') await new Promise<void>((resolver) => { liberar = resolver; });
      return original!(entrada, init);
    });
    pintar();
    await screen.findByLabelText(/correo electrónico/i);
    await rellenarFormulario();

    const boton = screen.getByRole('button', { name: /registrar pedido y continuar/i });
    await userEvent.click(boton);
    await userEvent.click(screen.getByRole('button', { name: /registrando pedido/i }));
    liberar();

    await screen.findByText(/Tu pedido HG-2026-0001 fue registrado/);
    expect(llamadas.filter((llamada) => llamada.url === '/api/pedidos')).toHaveLength(1);
  });

  it('si el backend rechaza el pedido, muestra el error junto al botón y permite reintentar', async () => {
    montar([{ coincidir: '/api/pedidos', status: 409, datos: { ok: false, mensaje: 'Stock insuficiente para Laptop HP 15.' } }]);
    pintar();
    await screen.findByLabelText(/correo electrónico/i);
    await rellenarFormulario();
    await userEvent.click(screen.getByRole('button', { name: /registrar pedido y continuar/i }));

    expect(await screen.findByText('Stock insuficiente para Laptop HP 15.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /registrar pedido y continuar/i })).toBeEnabled();
    expect(localStorage.getItem(CART_KEY)).not.toBe('[]');
  });
});
