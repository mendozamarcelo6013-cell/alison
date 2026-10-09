import { describe, expect, it } from 'vitest';
import { construirArbol, categoriasParaSelector, idsDescendientes } from '../src/utils/categorias';
import type { Categoria } from '../src/types';

const CATEGORIAS: Categoria[] = [
  { id: 10, nombre: 'Tecnologías', slug: 'tecnologias', parent_id: null, orden: 1, activa: true },
  { id: 11, nombre: 'Videovigilancia', slug: 'videovigilancia', parent_id: 10, orden: 1, activa: true },
  { id: 12, nombre: 'Redes y cableado', slug: 'redes-y-cableado', parent_id: 10, orden: 2, activa: true },
  { id: 20, nombre: 'Educación', slug: 'educacion', parent_id: null, orden: 2, activa: true },
  { id: 21, nombre: 'Cursos', slug: 'cursos', parent_id: 20, orden: 1, activa: true },
  { id: 22, nombre: 'Capacitaciones', slug: 'capacitaciones', parent_id: 20, orden: 2, activa: true },
  { id: 30, nombre: 'Categoría vacía', slug: 'categoria-vacia', parent_id: 10, orden: 3, activa: true },
];

describe('jerarquía de categorías', () => {
  it('construye raíces, subcategorías y niveles adicionales sin nombres codificados', () => {
    const arbol = construirArbol(CATEGORIAS);
    expect(arbol.map((nodo) => nodo.slug)).toEqual(['tecnologias', 'educacion']);
    expect(arbol[0].hijas.map((nodo) => nodo.slug)).toEqual([
      'videovigilancia', 'redes-y-cableado', 'categoria-vacia',
    ]);
    expect(categoriasParaSelector(CATEGORIAS).map(({ categoria, nivel }) => `${nivel}:${categoria.slug}`)).toEqual([
      '0:tecnologias', '1:videovigilancia', '1:redes-y-cableado', '1:categoria-vacia',
      '0:educacion', '1:cursos', '1:capacitaciones',
    ]);
  });

  it('obtiene todos los descendientes de un padre y sólo el propio nodo para una hoja', () => {
    expect([...idsDescendientes(CATEGORIAS, 10)]).toEqual([10, 11, 12, 30]);
    expect([...idsDescendientes(CATEGORIAS, 11)]).toEqual([11]);
  });

  it('tolera una categoría padre inexistente sin romper el árbol', () => {
    const arbol = construirArbol([
      ...CATEGORIAS,
      { id: 99, nombre: 'Huérfana', slug: 'huerfana', parent_id: 404, activa: true },
    ]);
    expect(arbol.some((nodo) => nodo.id === 99)).toBe(true);
  });
});
