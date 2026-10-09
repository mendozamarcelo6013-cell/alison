/** Utilidades puras compartidas por las cinco páginas. */

export function textoSeguro(valor: unknown, alternativa = ''): string {
  return typeof valor === 'string' ? valor : alternativa;
}

/** Equivalente de `texto()` del panel admin: vacío → guion medio. */
export function textoColumna(valor: unknown, alternativa = '—'): string {
  if (typeof valor === 'string' && valor.trim()) return valor;
  if (valor === null || valor === undefined) return alternativa;
  return String(valor);
}

/** Quita tildes y pasa a minúsculas: la búsqueda del catálogo lo usa. */
export function normalizarTexto(valor: unknown): string {
  return textoSeguro(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

function numero(valor: unknown): number {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : Number.NaN;
}

/** `S/ 12.50` o "Precio por consultar" (catálogo y detalle). */
export function formatearPrecio(valor: unknown): string {
  const convertido = numero(valor);
  return Number.isFinite(convertido) ? `S/ ${convertido.toFixed(2)}` : 'Precio por consultar';
}

/** Importe numérico; cualquier cosa no numérica vale 0 (sólo informativo). */
export function precioNumero(valor: unknown): number {
  const convertido = numero(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

/** `S/ 12.50` sin salida alternativa (carrito, resumen, panel). */
export function precioTexto(valor: unknown): string {
  return `S/ ${precioNumero(valor).toFixed(2)}`;
}

/** Moneda del panel: muestra guion cuando el dato no es numérico. */
export function monedaAdmin(valor: unknown): string {
  const convertido = numero(valor);
  return Number.isFinite(convertido) ? `S/ ${convertido.toFixed(2)}` : '—';
}

export function fechaCorta(iso?: string | null): string {
  if (!iso) return '—';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function cantidadEntera(valor: unknown, alternativa = 1): number {
  const cantidad = Number.parseInt(String(valor), 10);
  return Number.isInteger(cantidad) && cantidad > 0 ? cantidad : alternativa;
}

export function limiteStock(stock: unknown): number | null {
  const cantidad = Number.parseInt(String(stock), 10);
  return Number.isInteger(cantidad) && cantidad >= 0 ? cantidad : null;
}
