import { useEffect, useRef, type ReactNode } from 'react';

interface PropsModal {
  abierto: boolean;
  onCerrar: () => void;
  children: ReactNode;
  id?: string;
  className?: string;
  role?: string;
  labelledBy?: string;
  /** Cerrar al pulsar fuera del diálogo (modal de producto y detalle). */
  cerrarAlPulsarFondo?: boolean;
  /** Cerrar con la tecla Escape (no se usa en el muro de login). */
  cerrarAlEscape?: boolean;
}

/**
 * Diálogo con la misma mecánica que `abrirCapa`/`cerrarCapa` del panel
 * original: foco inicial en el primer control, trampa de Tab y devolución
 * del foco al elemento que abrió la capa.
 */
export function Modal({
  abierto,
  onCerrar,
  children,
  id,
  className = 'modal',
  role = 'dialog',
  labelledBy,
  cerrarAlPulsarFondo = false,
  cerrarAlEscape = false,
}: PropsModal) {
  const fondoRef = useRef<HTMLDivElement>(null);
  const ultimoFocoRef = useRef<HTMLElement | null>(null);
  const alCerrarRef = useRef(onCerrar);
  const alEscapeRef = useRef(cerrarAlEscape);
  alCerrarRef.current = onCerrar;
  alEscapeRef.current = cerrarAlEscape;

  useEffect(() => {
    if (!abierto) return undefined;

    ultimoFocoRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const fondo = fondoRef.current;
    const focoInicial = fondo?.querySelector<HTMLElement>('input, select, textarea, button');
    focoInicial?.focus();

    const manejarTecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        if (alEscapeRef.current) alCerrarRef.current();
        return;
      }
      if (evento.key !== 'Tab' || !fondo) return;

      const focos = [...fondo.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href]')]
        .filter((elemento) => !(elemento as HTMLButtonElement).disabled);
      if (!focos.length) return;

      const primero = focos[0];
      const ultimo = focos[focos.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };

    fondo?.addEventListener('keydown', manejarTecla);

    return () => {
      fondo?.removeEventListener('keydown', manejarTecla);
      const anterior = ultimoFocoRef.current;
      if (anterior && document.contains(anterior)) anterior.focus();
    };
  }, [abierto]);

  if (!abierto) return null;

  return (
    <div
      id={id}
      ref={fondoRef}
      className="modal-backdrop"
      onClick={(evento) => {
        if (cerrarAlPulsarFondo && evento.target === evento.currentTarget) onCerrar();
      }}
    >
      <div className={className} role={role} aria-modal="true" aria-labelledby={labelledBy}>
        {children}
      </div>
    </div>
  );
}
