import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPage } from '../src/pages/AdminPage';
import { TOKEN_KEY } from '../src/api/admin';
import { cabecera, crearFetch, llamadaPorUrl, productoDePrueba } from './ayudas';

const RUTAS = [
  {
    coincidir: '/api/admin/auth/me',
    datos: { ok: true, usuario: { id: 1, email: 'admin@horus.test', rol: 'admin' } },
  },
  {
    coincidir: '/api/admin/productos',
    datos: {
      ok: true,
      productos: [
        productoDePrueba(),
        productoDePrueba({ id: 2, nombre: 'Teclado Mecánico', slug: 'teclado-mecanico', activo: false, stock: 0 }),
      ],
      paginacion: { total: 2, page: 1, limit: 10, totalPages: 1 },
    },
  },
  {
    coincidir: '/api/admin/categorias',
    datos: { ok: true, categorias: [{ id: 1, nombre: 'Laptops', slug: 'laptops', activa: true }] },
  },
  {
    coincidir: '/api/admin/stats',
    datos: { ok: true, stats: { total: 2, publicados: 1, borradores: 1, sinStock: 1, destacados: 1 } },
  },
];

function tokenPrueba(valor = 'tok-abc') {
  sessionStorage.setItem(TOKEN_KEY, valor);
}

describe('Panel de administración', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('no pide datos al backend sin token y muestra el muro de acceso', async () => {
    const { fetchStub } = crearFetch(RUTAS);
    vi.stubGlobal('fetch', fetchStub);

    render(<AdminPage />);

    expect(await screen.findByText('Acceso al panel')).toBeInTheDocument();
    expect(screen.getByText(/solo usuarios con rol/i)).toBeInTheDocument();
    expect(fetchStub).not.toHaveBeenCalled();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('carga el listado con el token de sessionStorage en la cabecera Authorization', async () => {
    tokenPrueba('tok-abc');
    const { fetchStub, llamadas } = crearFetch(RUTAS);
    vi.stubGlobal('fetch', fetchStub);

    render(<AdminPage />);

    expect(await screen.findByText('Laptop HP 15')).toBeInTheDocument();
    expect(screen.getByText('Teclado Mecánico')).toBeInTheDocument();
    expect(screen.getByText('Borrador')).toBeInTheDocument();
    expect(screen.queryByText('Acceso al panel')).not.toBeInTheDocument();
    expect(screen.getByText('admin@horus.test')).toBeInTheDocument();

    const listado = llamadaPorUrl(llamadas, '/api/admin/productos?page=1&limit=10');
    expect(cabecera(listado, 'Authorization')).toBe('Bearer tok-abc');
    expect(cabecera(listado, 'Content-Type')).toBe('application/json');

    expect(document.getElementById('stat-total')?.textContent).toBe('2');
    expect(document.getElementById('page-info')?.textContent).toBe('Página 1 de 1');
    expect(document.getElementById('pagination-info')?.textContent).toBe('2 elemento(s)');
  });

  it('inicia sesión y guarda el token sólo en sessionStorage', async () => {
    const { fetchStub, llamadas } = crearFetch([
      ...RUTAS,
      {
        coincidir: '/api/admin/auth/login',
        datos: { ok: true, token: 'token-nuevo', usuario: { id: 1, email: 'admin@horus.test', rol: 'admin' } },
      },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    render(<AdminPage />);
    await screen.findByText('Acceso al panel');

    await userEvent.type(screen.getByLabelText('Email'), 'admin@horus.test');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secreto');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByText('Laptop HP 15')).toBeInTheDocument();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe('token-nuevo');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();

    const login = llamadaPorUrl(llamadas, '/api/admin/auth/login');
    expect(login?.init?.method).toBe('POST');
    expect(login?.init?.headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(String(login?.init?.body))).toEqual({ email: 'admin@horus.test', password: 'secreto' });
  });

  it('informa el error del backend sin crear token', async () => {
    const { fetchStub } = crearFetch([
      {
        coincidir: '/api/admin/auth/login',
        datos: { ok: false, mensaje: 'Credenciales inválidas.' },
        status: 401,
      },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    render(<AdminPage />);
    await screen.findByText('Acceso al panel');

    await userEvent.type(screen.getByLabelText('Email'), 'mal@horus.test');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mala');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByText('Credenciales inválidas.')).toBeInTheDocument();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('envía a papelera con DELETE sin borrado definitivo', async () => {
    tokenPrueba();
    const { fetchStub, llamadas } = crearFetch(RUTAS);
    vi.stubGlobal('fetch', fetchStub);

    render(<AdminPage />);
    await screen.findByText('Laptop HP 15');

    await userEvent.click(screen.getByRole('button', { name: 'Papelera' }));

    expect(await screen.findByText(/se despublicará y podrá restaurarse/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Enviar a papelera' }));

    expect(await screen.findByText('Producto enviado a papelera.')).toBeInTheDocument();

    const borrado = llamadas.find(
      (llamada) => llamada.url === '/api/admin/productos/1' && llamada.init?.method === 'DELETE',
    );
    expect(borrado).toBeDefined();
    expect(llamadas.some((llamada) => /\?force|definitivo/.test(llamada.url))).toBe(false);
  });
});
