import { useState } from 'react';
import { ProductoImagen } from '../components/ProductoImagen';
import { textoSeguro } from '../utils/format';

interface Props {
  imagenes: Array<{ id: number; url: string; texto_alternativo: string | null }>;
  nombreProducto: string;
}

/**
 * Galería con imagen principal, flechas, puntos y animación de entrada.
 * Con una sola imagen no se muestran controles; sin imágenes, un sustituto.
 */
export function GaleriaProducto({ imagenes, nombreProducto }: Props) {
  const [indice, setIndice] = useState(0);
  const [animar, setAnimar] = useState(false);

  if (imagenes.length === 0) {
    return <div className="image-placeholder">Imagen no disponible</div>;
  }

  const imagenActual = imagenes[indice] ?? imagenes[0];

  const cambiar = (siguiente: number) => {
    setIndice((siguiente + imagenes.length) % imagenes.length);
    setAnimar(true);
  };

  return (
    <>
      <div className="gallery-frame">
        <div className="gallery-image-layer">
          <ProductoImagen
            key={imagenActual.id}
            url={imagenActual.url}
            alt={textoSeguro(imagenActual.texto_alternativo, nombreProducto)}
            className={`product-main-image${animar ? ' gallery-image-enter' : ''}`}
            placeholderClassName="image-placeholder"
          />
        </div>
        {imagenes.length > 1 ? (
          <>
            <button
              type="button"
              className="gallery-arrow gallery-previous"
              aria-label="Imagen anterior"
              onClick={() => cambiar(indice - 1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="gallery-arrow gallery-next"
              aria-label="Imagen siguiente"
              onClick={() => cambiar(indice + 1)}
            >
              ›
            </button>
          </>
        ) : null}
      </div>
      {imagenes.length > 1 ? (
        <div className="gallery-dots">
          {imagenes.map((imagen, posicion) => {
            const activa = posicion === indice;
            return (
              <button
                key={imagen.id}
                type="button"
                className={`gallery-dot${activa ? ' active' : ''}`}
                aria-label={`Ver imagen ${posicion + 1}`}
                aria-current={activa ? 'true' : 'false'}
                onClick={() => cambiar(posicion)}
              />
            );
          })}
        </div>
      ) : null}
    </>
  );
}
