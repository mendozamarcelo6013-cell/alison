import { useState } from 'react';
import { textoSeguro } from '../utils/format';

interface PropsImagenProducto {
  url?: string | null;
  alt: string;
  /** Clase del <img> cuando hay imagen (p. ej. "product-image"). */
  className: string;
  /** Clase del sustituto cuando falta o falla la imagen. */
  placeholderClassName: string;
  textoPlaceholder?: string;
  loading?: 'lazy';
}

/**
 * Imagen con sustituto "Imagen no disponible": también se reemplaza si el
 * navegador no puede cargar el archivo (mismo comportamiento que el onerror
 * del frontend original).
 */
export function ProductoImagen({
  url,
  alt,
  className,
  placeholderClassName,
  textoPlaceholder = 'Imagen no disponible',
  loading,
}: PropsImagenProducto) {
  const [fallida, setFallida] = useState(false);
  const direccion = textoSeguro(url).trim();

  if (!direccion || fallida) {
    return <div className={placeholderClassName}>{textoPlaceholder}</div>;
  }

  return (
    <img
      className={className}
      src={direccion}
      alt={alt}
      loading={loading}
      onError={() => setFallida(true)}
    />
  );
}
