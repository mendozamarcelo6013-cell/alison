import { cantidadEntera, limiteStock, textoSeguro } from '../utils/format';
import type { ItemCarrito } from '../types';

/**
 * Persistencia del carrito. Se conserva la clave exacta y el formato de la
 * versión vanilla para seguir leyendo los datos guardados por el usuario.
 */
export const CART_KEY = 'horus_market_cart';

/** Valida, normaliza y fusiona duplicados por slug (mismo criterio que cart.js). */
export function normalizarCarrito(valor: unknown): ItemCarrito[] {
  if (!Array.isArray(valor)) return [];

  const porSlug = new Map<string, ItemCarrito>();
  valor.forEach((item) => {
    const elemento = item as Partial<ItemCarrito> | null | undefined;
    const productoId = Number.parseInt(String(elemento?.producto_id), 10);
    const slug = textoSeguro(elemento?.slug).trim();
    if (!Number.isInteger(productoId) || productoId < 1 || !slug) return;

    const existente = porSlug.get(slug);
    const cantidad = cantidadEntera(elemento?.cantidad);
    porSlug.set(slug, {
      producto_id: productoId,
      slug,
      cantidad: existente ? existente.cantidad + cantidad : cantidad,
    });
  });

  return [...porSlug.values()];
}

export function leerCarrito(): ItemCarrito[] {
  try {
    return normalizarCarrito(JSON.parse(localStorage.getItem(CART_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function guardarCarrito(items: unknown): ItemCarrito[] {
  const carrito = normalizarCarrito(items);
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(carrito));
  } catch (error) {
    console.error('No se pudo guardar el carrito local:', error);
  }
  return carrito;
}

export interface AltaProducto {
  producto_id: number;
  slug: string;
  cantidad?: number;
  stock: number;
}

export function agregarProducto({ producto_id, slug, cantidad = 1, stock }: AltaProducto): ItemCarrito {
  const productoId = Number.parseInt(String(producto_id), 10);
  const slugSeguro = textoSeguro(slug).trim();
  const maximo = limiteStock(stock);

  if (!Number.isInteger(productoId) || productoId < 1 || !slugSeguro || maximo === null) {
    throw new Error('No se pudo validar el producto para agregarlo al carrito.');
  }
  if (maximo === 0) {
    throw new Error('El producto está agotado.');
  }

  const carrito = leerCarrito();
  const indice = carrito.findIndex((item) => item.slug === slugSeguro);
  const solicitada = cantidadEntera(cantidad);

  if (indice === -1) {
    carrito.push({
      producto_id: productoId,
      slug: slugSeguro,
      cantidad: Math.min(solicitada, maximo),
    });
  } else {
    carrito[indice].cantidad = Math.min(carrito[indice].cantidad + solicitada, maximo);
  }

  return guardarCarrito(carrito).find((item) => item.slug === slugSeguro) as ItemCarrito;
}

export function actualizarCantidad(slug: string, cantidad: number, stock: number): ItemCarrito | null {
  const slugSeguro = textoSeguro(slug).trim();
  const maximo = limiteStock(stock);
  const carrito = leerCarrito();
  const indice = carrito.findIndex((item) => item.slug === slugSeguro);
  if (indice === -1 || maximo === null || maximo === 0) return carrito[indice] || null;

  carrito[indice].cantidad = Math.min(Math.max(cantidadEntera(cantidad), 1), maximo);
  return guardarCarrito(carrito).find((item) => item.slug === slugSeguro) || null;
}

export function eliminarProducto(slug: string): ItemCarrito[] {
  const slugSeguro = textoSeguro(slug).trim();
  return guardarCarrito(leerCarrito().filter((item) => item.slug !== slugSeguro));
}

export function contarUnidades(items: ItemCarrito[]): number {
  return items.reduce((acumulado, item) => acumulado + item.cantidad, 0);
}
