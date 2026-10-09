import { useLayoutEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { ORDEN_HOJAS, hojasParaRuta } from './hojas';

/**
 * Activa el CSS de la ruta actual antes del pintado (layout effect): sólo los
 * `<link data-hojas>` de la ruta pasan a `media="all"` y el resto queda en
 * `media="not all"`, de modo que nunca conviven hojas de vistas distintas.
 *
 * Sólo alterna los enlaces ya presentes en index.html (el shell de la SPA); si
 * faltara alguno se omite, porque enlazarlo con una URL inventada rompería la
 * cascada en lugar de arreglarla.
 */
export function HojasDeRuta() {
  const { pathname } = useLocation();
  const claves = useMemo(() => hojasParaRuta(pathname).join(','), [pathname]);

  useLayoutEffect(() => {
    const activas = new Set(claves.split(',').filter(Boolean));

    for (const clave of ORDEN_HOJAS) {
      const enlace = document.head.querySelector<HTMLLinkElement>(`link[data-hojas="${clave}"]`);
      if (enlace) enlace.media = activas.has(clave) ? 'all' : 'not all';
    }
  }, [claves]);

  return null;
}
