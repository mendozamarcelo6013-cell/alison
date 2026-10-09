import type { Categoria } from '../types';

export interface CategoriaNodo extends Categoria {
  hijas: CategoriaNodo[];
}

export function ordenarCategorias(a: Categoria, b: Categoria): number {
  const ordenA = Number(a.orden ?? 0);
  const ordenB = Number(b.orden ?? 0);
  if (ordenA !== ordenB) return ordenA - ordenB;
  const nombre = a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
  return nombre || a.id - b.id;
}

export function construirArbol(categorias: Categoria[]): CategoriaNodo[] {
  const ordenadas = [...categorias].sort(ordenarCategorias);
  const nodos = new Map<number, CategoriaNodo>(ordenadas.map((categoria) => [
    categoria.id,
    { ...categoria, hijas: [] },
  ]));
  const raices: CategoriaNodo[] = [];

  nodos.forEach((nodo) => {
    const padre = nodo.parent_id == null ? undefined : nodos.get(Number(nodo.parent_id));
    if (padre && padre.id !== nodo.id) padre.hijas.push(nodo);
    else raices.push(nodo);
  });

  const ordenarNodos = (lista: CategoriaNodo[]) => {
    lista.sort(ordenarCategorias);
    lista.forEach((nodo) => ordenarNodos(nodo.hijas));
    return lista;
  };
  return ordenarNodos(raices);
}

export function idsDescendientes(categorias: Categoria[], categoriaId: number): Set<number> {
  const hijos = new Map<number, number[]>();
  categorias.forEach((categoria) => {
    if (categoria.parent_id == null) return;
    const lista = hijos.get(Number(categoria.parent_id)) ?? [];
    lista.push(categoria.id);
    hijos.set(Number(categoria.parent_id), lista);
  });

  const resultado = new Set<number>([categoriaId]);
  const pendientes = [categoriaId];
  while (pendientes.length) {
    const actual = pendientes.shift()!;
    (hijos.get(actual) ?? []).forEach((hijo) => {
      if (!resultado.has(hijo)) {
        resultado.add(hijo);
        pendientes.push(hijo);
      }
    });
  }
  return resultado;
}

export function categoriasParaSelector(categorias: Categoria[]): Array<{ categoria: Categoria; nivel: number }> {
  const salida: Array<{ categoria: Categoria; nivel: number }> = [];
  const visitar = (nodos: Categoria[], nivel: number) => {
    nodos.forEach((categoria) => {
      salida.push({ categoria, nivel });
      const hijas = categorias.filter((item) => item.parent_id === categoria.id).sort(ordenarCategorias);
      visitar(hijas, nivel + 1);
    });
  };
  visitar(construirArbol(categorias), 0);
  return salida;
}
