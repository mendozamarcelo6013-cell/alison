import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  CART_KEY,
  agregarProducto as agregarEnAlmacen,
  actualizarCantidad as actualizarEnAlmacen,
  contarUnidades,
  eliminarProducto as eliminarEnAlmacen,
  guardarCarrito,
  leerCarrito,
  type AltaProducto,
} from './cart';
import type { ItemCarrito } from '../types';

interface ValorCarrito {
  items: ItemCarrito[];
  unidades: number;
  agregar: (alta: AltaProducto) => ItemCarrito | undefined;
  actualizar: (slug: string, cantidad: number, stock: number) => ItemCarrito | null;
  eliminar: (slug: string) => void;
  vaciar: () => void;
  recargar: () => void;
}

const CarritoContexto = createContext<ValorCarrito | null>(null);

/**
 * Fuente única de estado del carrito en cada página. La persistencia sigue en
 * localStorage["horus_market_cart"]; los cambios de otras pestañas se reflejan
 * mediante el evento `storage`.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ItemCarrito[]>(() => leerCarrito());

  const recargar = useCallback(() => setItems(leerCarrito()), []);

  useEffect(() => {
    const alCambiar = (evento: StorageEvent) => {
      if (evento.key === CART_KEY) setItems(leerCarrito());
    };
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, []);

  // Lanza los mismos mensajes que la versión vanilla (producto agotado, etc.).
  const agregar = useCallback((alta: AltaProducto) => {
    const guardado = agregarEnAlmacen(alta);
    setItems(leerCarrito());
    return guardado;
  }, []);

  const actualizar = useCallback((slug: string, cantidad: number, stock: number) => {
    const actualizado = actualizarEnAlmacen(slug, cantidad, stock);
    setItems(leerCarrito());
    return actualizado;
  }, []);

  const eliminar = useCallback((slug: string) => {
    eliminarEnAlmacen(slug);
    setItems(leerCarrito());
  }, []);

  const vaciar = useCallback(() => {
    guardarCarrito([]);
    setItems([]);
  }, []);

  const valor = useMemo<ValorCarrito>(() => ({
    items,
    unidades: contarUnidades(items),
    agregar,
    actualizar,
    eliminar,
    vaciar,
    recargar,
  }), [items, agregar, actualizar, eliminar, vaciar, recargar]);

  return <CarritoContexto.Provider value={valor}>{children}</CarritoContexto.Provider>;
}

export function useCart(): ValorCarrito {
  const contexto = useContext(CarritoContexto);
  if (!contexto) throw new Error('useCart debe usarse dentro de CartProvider.');
  return contexto;
}
