'use strict';

function ordenarCategorias(a, b) {
  const ordenA = Number(a.orden || 0);
  const ordenB = Number(b.orden || 0);
  if (ordenA !== ordenB) return ordenA - ordenB;
  const nombre = String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' });
  if (nombre !== 0) return nombre;
  return Number(a.id || 0) - Number(b.id || 0);
}

function mapaCategorias(categorias) {
  return new Map(categorias.map((categoria) => [Number(categoria.id), categoria]));
}

function jerarquiaVisible(categoria, mapa, visitados = new Set()) {
  if (!categoria || categoria.activa === false) return false;
  const id = Number(categoria.id);
  if (visitados.has(id)) return false;
  if (categoria.parent_id === null || categoria.parent_id === undefined) return true;
  const padre = mapa.get(Number(categoria.parent_id));
  if (!padre) return false;
  const siguientes = new Set(visitados);
  siguientes.add(id);
  return jerarquiaVisible(padre, mapa, siguientes);
}

function categoriasPublicas(categorias) {
  const lista = Array.isArray(categorias) ? categorias : [];
  const mapa = mapaCategorias(lista);
  return lista
    .filter((categoria) => jerarquiaVisible(categoria, mapa))
    .sort(ordenarCategorias);
}

function construirArbol(categorias) {
  const lista = Array.isArray(categorias) ? categorias.slice().sort(ordenarCategorias) : [];
  const nodos = new Map(lista.map((categoria) => [Number(categoria.id), { ...categoria, hijas: [] }]));
  const raices = [];

  nodos.forEach((nodo) => {
    const parentId = nodo.parent_id == null ? null : Number(nodo.parent_id);
    const padre = parentId === null ? null : nodos.get(parentId);
    if (padre && padre !== nodo) padre.hijas.push(nodo);
    else raices.push(nodo);
  });

  const ordenarNodos = (nodosActuales) => {
    nodosActuales.sort(ordenarCategorias);
    nodosActuales.forEach((nodo) => ordenarNodos(nodo.hijas));
    return nodosActuales;
  };
  return ordenarNodos(raices);
}

function idsDescendientes(categorias, categoriaId) {
  const idObjetivo = Number(categoriaId);
  if (!Number.isInteger(idObjetivo)) return new Set();
  const hijos = new Map();
  (Array.isArray(categorias) ? categorias : []).forEach((categoria) => {
    const parentId = categoria.parent_id == null ? null : Number(categoria.parent_id);
    if (parentId === null) return;
    const lista = hijos.get(parentId) || [];
    lista.push(Number(categoria.id));
    hijos.set(parentId, lista);
  });

  const resultado = new Set([idObjetivo]);
  const pendientes = [idObjetivo];
  while (pendientes.length) {
    const actual = pendientes.shift();
    (hijos.get(actual) || []).forEach((hijo) => {
      if (!resultado.has(hijo)) {
        resultado.add(hijo);
        pendientes.push(hijo);
      }
    });
  }
  return resultado;
}

async function validarPadre(Categoria, parentId, selfId = null, options = {}) {
  if (parentId === null || parentId === undefined || parentId === '') return null;
  const idPadre = Number(parentId);
  if (!Number.isInteger(idPadre) || idPadre < 1) throw new Error('La categoría padre no es válida.');
  if (selfId !== null && idPadre === Number(selfId)) throw new Error('Una categoría no puede ser su propio padre.');

  const transaction = options.transaction;
  const padre = await Categoria.findByPk(idPadre, { transaction });
  if (!padre) throw new Error('La categoría padre no existe.');
  if (padre.activa === false) throw new Error('La categoría padre debe estar activa.');

  const vistos = new Set([idPadre]);
  let actual = padre;
  while (actual?.parent_id != null) {
    const ancestroId = Number(actual.parent_id);
    if (selfId !== null && ancestroId === Number(selfId)) throw new Error('La relación formaría un ciclo de categorías.');
    if (vistos.has(ancestroId)) throw new Error('La jerarquía existente contiene un ciclo.');
    vistos.add(ancestroId);
    actual = await Categoria.findByPk(ancestroId, { transaction });
    if (!actual) throw new Error('La jerarquía del padre es inconsistente.');
  }
  return idPadre;
}

module.exports = {
  ordenarCategorias,
  categoriasPublicas,
  construirArbol,
  idsDescendientes,
  validarPadre,
};
