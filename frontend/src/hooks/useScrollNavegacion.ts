import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Gestiona el scroll entre rutas de la SPA: una navegación nueva empieza arriba
 * y volver atrás (POP) recupera la posición donde se estaba, p. ej. la fila del
 * catálogo desde la que se abrió un producto.
 */
export function useScrollNavegacion(): void {
  const { key, hash } = useLocation();
  const tipo = useNavigationType();
  const posiciones = useRef(new Map<string, number>());
  const claveActual = useRef(key);

  useEffect(() => {
    claveActual.current = key;
  }, [key]);

  useEffect(() => {
    let pendiente = 0;
    const guardar = () => {
      cancelAnimationFrame(pendiente);
      pendiente = requestAnimationFrame(() => {
        posiciones.current.set(claveActual.current, window.scrollY);
      });
    };
    window.addEventListener('scroll', guardar, { passive: true });
    return () => {
      cancelAnimationFrame(pendiente);
      window.removeEventListener('scroll', guardar);
    };
  }, []);

  useLayoutEffect(() => {
    if (hash) return;
    const guardada = tipo === 'POP' ? posiciones.current.get(key) : undefined;
    // `behavior: instant` ignora el `scroll-behavior: smooth` global del CSS.
    window.scrollTo({ top: guardada ?? 0, left: 0, behavior: 'instant' });
  }, [key, hash, tipo]);
}
