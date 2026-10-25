/**
 * Filtros del catálogo que sobreviven a la navegación Catálogo → Producto →
 * Catálogo (la página se desmonta al salir). Sólo viven en memoria: se pierden
 * al recargar, como cualquier estado de vista.
 */
export interface FiltrosCatalogo {
  categoriaActiva: number | null;
  busqueda: string;
  /** Grupos de categoría desplegados; `null` mientras no se haya decidido. */
  gruposAbiertos: number[] | null;
}

const INICIALES: FiltrosCatalogo = { categoriaActiva: null, busqueda: '', gruposAbiertos: null };

let guardados: FiltrosCatalogo = INICIALES;

export function leerFiltrosCatalogo(): FiltrosCatalogo {
  return guardados;
}

export function guardarFiltrosCatalogo(filtros: FiltrosCatalogo): void {
  guardados = filtros;
}

export function reiniciarFiltrosCatalogo(): void {
  guardados = INICIALES;
}
