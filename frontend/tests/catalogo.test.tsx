import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearFetch, pintarApp, productoDePrueba } from './ayudas';

function pintar() {
  return pintarApp('/market');
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

  it('filtra una categoría principal incluyendo sus descendientes y combina búsqueda', async () => {
    const categorias = {
      ok: true,
      categorias: [
        { id: 10, nombre: 'Tecnologías', slug: 'tecnologias', parent_id: null, activa: true, orden: 1 },
        { id: 11, nombre: 'Videovigilancia', slug: 'videovigilancia', parent_id: 10, activa: true, orden: 1 },
        { id: 12, nombre: 'Redes y cableado', slug: 'redes-y-cableado', parent_id: 10, activa: true, orden: 2 },
        { id: 20, nombre: 'Educación', slug: 'educacion', parent_id: null, activa: true, orden: 2 },
        { id: 21, nombre: 'Cursos', slug: 'cursos', parent_id: 20, activa: true, orden: 1 },
      ],
    };
    const productos = {
      ok: true,
      productos: [
        productoDePrueba({ id: 5, nombre: 'Cámara IP Full HD', categoria: { id: 11, nombre: 'Videovigilancia', slug: 'videovigilancia' } }),
        productoDePrueba({ id: 9, nombre: 'Cable UTP Cat 6', categoria: { id: 12, nombre: 'Redes y cableado', slug: 'redes-y-cableado' } }),
        productoDePrueba({ id: 14, nombre: 'Curso virtual', categoria: { id: 21, nombre: 'Cursos', slug: 'cursos' } }),
      ],
    };
    const { fetchStub } = crearFetch([
      { coincidir: '/api/categorias', datos: categorias },
      { coincidir: '/api/productos', datos: productos },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    pintar();
    expect(await screen.findByText('Cámara IP Full HD')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Tecnologías' }));
    expect(screen.getByText('Cámara IP Full HD')).toBeInTheDocument();
    expect(screen.getByText('Cable UTP Cat 6')).toBeInTheDocument();
    expect(screen.queryByText('Curso virtual')).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('searchbox'), 'cámara');
    expect(screen.getByText('Cámara IP Full HD')).toBeInTheDocument();
    expect(screen.queryByText('Cable UTP Cat 6')).not.toBeInTheDocument();
  });

  it('separa selección y expansión del grupo', async () => {
    const { fetchStub } = crearFetch([
      {
        coincidir: '/api/categorias',
        datos: { ok: true, categorias: [{ id: 10, nombre: 'Tecnologías', slug: 'tecnologias', parent_id: null, activa: true }, { id: 11, nombre: 'Videovigilancia', slug: 'videovigilancia', parent_id: 10, activa: true }] },
      },
      { coincidir: '/api/productos', datos: { ok: true, productos: [productoDePrueba({ categoria: { id: 11, nombre: 'Videovigilancia', slug: 'videovigilancia' } })] } },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    pintar();
    await screen.findByText('Videovigilancia');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Contraer Tecnologías' })).toHaveAttribute('aria-expanded', 'true'));
    const control = screen.getByRole('button', { name: 'Contraer Tecnologías' });
    expect(control).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(control);
    expect(screen.queryByRole('button', { name: 'Videovigilancia' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expandir Tecnologías' })).toHaveAttribute('aria-expanded', 'false');
  });
});
