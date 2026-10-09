const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  categoriasPublicas,
  construirArbol,
  idsDescendientes,
} = require('../src/services/categoriaJerarquia');
const { slugificar, normalizar, validar } = require('../src/controllers/adminCategoriaController')._privado;

const CATEGORIAS = [
  { id: 10, nombre: 'Tecnologías', slug: 'tecnologias', parent_id: null, activa: true, orden: 1 },
  { id: 11, nombre: 'Videovigilancia', slug: 'videovigilancia', parent_id: 10, activa: true, orden: 1 },
  { id: 12, nombre: 'Redes y cableado', slug: 'redes-y-cableado', parent_id: 10, activa: true, orden: 2 },
  { id: 20, nombre: 'Educación', slug: 'educacion', parent_id: null, activa: true, orden: 2 },
  { id: 21, nombre: 'Cursos', slug: 'cursos', parent_id: 20, activa: true, orden: 1 },
];

describe('jerarquía de categorías backend', () => {
  it('conserva sólo categorías activas con ancestros visibles', () => {
    const visibles = categoriasPublicas([
      ...CATEGORIAS,
      { id: 30, nombre: 'Inactiva', slug: 'inactiva', parent_id: null, activa: false, orden: 3 },
      { id: 31, nombre: 'Hija inválida', slug: 'hija-invalida', parent_id: 30, activa: true, orden: 1 },
      { id: 32, nombre: 'Huérfana', slug: 'huerfana', parent_id: 404, activa: true, orden: 1 },
    ]);
    assert.deepEqual(new Set(visibles.map((categoria) => categoria.id)), new Set([10, 11, 12, 20, 21]));
  });

  it('detecta descendientes y construye raíces ordenadas', () => {
    assert.deepEqual([...idsDescendientes(CATEGORIAS, 10)], [10, 11, 12]);
    assert.deepEqual(construirArbol(CATEGORIAS).map((nodo) => nodo.id), [10, 20]);
    assert.deepEqual(construirArbol(CATEGORIAS)[0].hijas.map((nodo) => nodo.id), [11, 12]);
  });

  it('rechaza ciclos en la visibilidad pública', () => {
    const visibles = categoriasPublicas([
      { id: 1, nombre: 'A', slug: 'a', parent_id: 2, activa: true },
      { id: 2, nombre: 'B', slug: 'b', parent_id: 1, activa: true },
    ]);
    assert.deepEqual(visibles, []);
  });
});

describe('validación administrativa de categorías', () => {
  it('normaliza slug y datos de formulario', () => {
    assert.equal(slugificar('Cursos y Capacitación'), 'cursos-y-capacitacion');
    assert.deepEqual(normalizar({ nombre: ' Educación ', parent_id: '', orden: '2', activa: 'true' }, true), {
      nombre: 'Educación', slug: 'educacion', parent_id: null, orden: 2, activa: true,
    });
  });

  it('rechaza nombre, slug y orden inválidos', () => {
    const errores = validar({ nombre: '', slug: 'No válido', orden: -1 }, true);
    assert.ok(errores.some((error) => /nombre/i.test(error)));
    assert.ok(errores.some((error) => /slug/i.test(error)));
    assert.ok(errores.some((error) => /orden/i.test(error)));
  });
});
