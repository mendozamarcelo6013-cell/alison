import { useCallback, useEffect, useState, type SyntheticEvent } from 'react';
import { textoSeguro } from '../utils/format';

interface PropsImagenProducto {
  url?: string | null;
  alt: string;
  /** Clase del <img> cuando hay imagen (p. ej. "product-image"). */
  className: string;
  /** Clase del sustituto cuando falta o falla la imagen. */
  placeholderClassName: string;
  textoPlaceholder?: string;
  /**
   * `true` para la imagen principal visible al abrir la página (LCP): se carga
   * sin diferir y con prioridad alta. El resto se difiere (`lazy`).
   */
  prioritaria?: boolean;
  /** Dimensiones intrínsecas sólo como proporción: evitan saltos de diseño. */
  ancho?: number;
  alto?: number;
}

/**
 * Imagen con sustituto "Imagen no disponible": también se reemplaza si el
 * navegador no puede cargar el archivo. Mientras descarga se ve el degradado del
 * contenedor y la imagen aparece con un fundido (sin parpadeo si ya estaba en la
 * caché del navegador). Admite URLs externas y rutas propias `/uploads/...`.
 */
export function ProductoImagen({
  url,
  alt,
  className,
  placeholderClassName,
  textoPlaceholder = 'Imagen no disponible',
  prioritaria = false,
  ancho,
  alto,
}: PropsImagenProducto) {
  const direccion = textoSeguro(url).trim();
  const [estado, setEstado] = useState<{ url: string; fase: 'cargando' | 'lista' | 'fallida' }>({
    url: direccion,
    fase: 'cargando',
  });

  // Si cambia la URL con el mismo componente montado, se reinicia el estado.
  const fase = estado.url === direccion ? estado.fase : 'cargando';
  useEffect(() => {
    setEstado((previo) => (previo.url === direccion ? previo : { url: direccion, fase: 'cargando' }));
  }, [direccion]);

  // Una imagen ya descargada (caché del navegador) puede estar `complete` antes
  // de que React enganche `onLoad`: se marca lista para evitar el fundido.
  const referencia = useCallback((imagen: HTMLImageElement | null) => {
    if (imagen?.complete && imagen.naturalWidth > 0) {
      setEstado((previo) => (previo.fase === 'lista' ? previo : { url: imagen.getAttribute('src') ?? '', fase: 'lista' }));
    }
  }, []);

  const alCargar = (evento: SyntheticEvent<HTMLImageElement>) => {
    setEstado({ url: evento.currentTarget.getAttribute('src') ?? direccion, fase: 'lista' });
  };

  if (!direccion || fase === 'fallida') {
    return <div className={placeholderClassName} title={alt}>{textoPlaceholder}</div>;
  }

  return (
    <img
      ref={referencia}
      className={`${className} img-fundido${fase === 'lista' ? ' img-lista' : ''}`}
      src={direccion}
      alt={alt}
      width={ancho}
      height={alto}
      loading={prioritaria ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={prioritaria ? 'high' : 'auto'}
      onLoad={alCargar}
      onError={() => setEstado({ url: direccion, fase: 'fallida' })}
    />
  );
}
