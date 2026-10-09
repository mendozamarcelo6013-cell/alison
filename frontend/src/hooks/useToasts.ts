import { useCallback, useRef, useState } from 'react';

export interface Aviso {
  id: number;
  texto: string;
  tipo: string;
}

/** Notificaciones flotantes del panel (3,8 s, igual que el original). */
export function useToasts() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const contador = useRef(0);

  const toast = useCallback((texto: string, tipo = '') => {
    contador.current += 1;
    const id = contador.current;
    setAvisos((previos) => [...previos, { id, texto, tipo }]);
    setTimeout(() => {
      setAvisos((previos) => previos.filter((aviso) => aviso.id !== id));
    }, 3800);
  }, []);

  return { avisos, toast };
}
