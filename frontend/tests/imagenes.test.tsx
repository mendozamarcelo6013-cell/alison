import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GaleriaProducto } from '../src/components/GaleriaProducto';
import { ProductoImagen } from '../src/components/ProductoImagen';

const IMAGENES = [
  { id: 1, url: 'https://cdn.ejemplo.test/a.jpg', texto_alternativo: 'Frente' },
  { id: 2, url: '/uploads/productos/b.jpg', texto_alternativo: null },
  { id: 3, url: 'https://cdn.ejemplo.test/c.jpg', texto_alternativo: null },
];

describe('ProductoImagen', () => {
  it('difiere la carga y decodifica en segundo plano por defecto', () => {
    render(<ProductoImagen url="/uploads/productos/x.jpg" alt="X" className="product-image" placeholderClassName="ph" ancho={800} alto={600} />);
    const imagen = screen.getByRole('img', { name: 'X' });
    expect(imagen).toHaveAttribute('loading', 'lazy');
    expect(imagen).toHaveAttribute('decoding', 'async');
    expect(imagen).toHaveAttribute('width', '800');
    expect(imagen).toHaveAttribute('height', '600');
    expect(imagen).not.toHaveClass('img-lista');
  });

  it('la imagen prioritaria se carga sin diferir y con prioridad alta', () => {
    render(<ProductoImagen url="https://cdn.ejemplo.test/x.jpg" alt="X" className="product-image" placeholderClassName="ph" prioritaria />);
    const imagen = screen.getByRole('img', { name: 'X' });
    expect(imagen).toHaveAttribute('loading', 'eager');
    expect(imagen).toHaveAttribute('fetchpriority', 'high');
  });

  it('marca la imagen como lista al cargar (fundido) y sustituye por el placeholder si falla', () => {
    render(<ProductoImagen url="/uploads/productos/x.jpg" alt="X" className="product-image" placeholderClassName="ph" />);
    const imagen = screen.getByRole('img', { name: 'X' });

    fireEvent.load(imagen);
    expect(imagen).toHaveClass('img-lista');

    fireEvent.error(imagen);
    expect(screen.queryByRole('img', { name: 'X' })).not.toBeInTheDocument();
    expect(screen.getByText('Imagen no disponible')).toHaveClass('ph');
  });

  it('muestra el placeholder sin intentar descargar cuando no hay URL', () => {
    render(<ProductoImagen url={null} alt="X" className="product-image" placeholderClassName="ph" />);
    expect(screen.getByText('Imagen no disponible')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('GaleriaProducto', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sin imágenes muestra el sustituto y ningún control', () => {
    render(<GaleriaProducto imagenes={[]} nombreProducto="Laptop" />);
    expect(screen.getByText('Imagen no disponible')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('con una sola imagen no muestra flechas ni miniaturas', () => {
    render(<GaleriaProducto imagenes={IMAGENES.slice(0, 1)} nombreProducto="Laptop" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('las miniaturas cambian la imagen principal e indican cuál está seleccionada', async () => {
    render(<GaleriaProducto imagenes={IMAGENES} nombreProducto="Laptop" />);
    const principal = () => document.querySelector('.product-main-image');
    expect(principal()).toHaveAttribute('src', IMAGENES[0].url);

    const miniaturas = screen.getAllByRole('button', { name: /^Ver imagen/ });
    expect(miniaturas).toHaveLength(3);
    expect(miniaturas[0]).toHaveAttribute('aria-current', 'true');
    expect(miniaturas[1]).not.toHaveAttribute('aria-current');

    await userEvent.click(miniaturas[2]);
    expect(principal()).toHaveAttribute('src', IMAGENES[2].url);
    expect(miniaturas[2]).toHaveAttribute('aria-current', 'true');
    expect(miniaturas[0]).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('status')).toHaveTextContent('Imagen 3 de 3');
  });

  it('las flechas recorren la galería de forma circular', async () => {
    render(<GaleriaProducto imagenes={IMAGENES} nombreProducto="Laptop" />);
    await userEvent.click(screen.getByRole('button', { name: 'Imagen anterior' }));
    expect(document.querySelector('.product-main-image')).toHaveAttribute('src', IMAGENES[2].url);
    await userEvent.click(screen.getByRole('button', { name: 'Imagen siguiente' }));
    expect(document.querySelector('.product-main-image')).toHaveAttribute('src', IMAGENES[0].url);
  });

  it('se puede usar sin ratón: ← y → cambian de imagen con el foco en la galería', async () => {
    render(<GaleriaProducto imagenes={IMAGENES} nombreProducto="Laptop" />);
    screen.getByRole('button', { name: 'Imagen siguiente' }).focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(document.querySelector('.product-main-image')).toHaveAttribute('src', IMAGENES[1].url);
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(document.querySelector('.product-main-image')).toHaveAttribute('src', IMAGENES[2].url);
  });

  it('precarga sólo la imagen siguiente, no todas las secundarias', async () => {
    const pedidas: string[] = [];
    class ImagenFalsa {
      decoding = '';
      set src(valor: string) { pedidas.push(valor); }
    }
    vi.stubGlobal('Image', ImagenFalsa);

    render(<GaleriaProducto imagenes={IMAGENES} nombreProducto="Laptop" />);
    expect(pedidas).toEqual([IMAGENES[1].url]);

    await userEvent.click(screen.getAllByRole('button', { name: /^Ver imagen/ })[1]);
    expect(pedidas).toEqual([IMAGENES[1].url, IMAGENES[2].url]);
  });

  it('las miniaturas se difieren (lazy) y la principal tiene prioridad', () => {
    render(<GaleriaProducto imagenes={IMAGENES} nombreProducto="Laptop" />);
    expect(document.querySelector('.product-main-image')).toHaveAttribute('loading', 'eager');
    for (const miniatura of document.querySelectorAll('.gallery-thumb-image')) {
      expect(miniatura).toHaveAttribute('loading', 'lazy');
    }
  });
});
