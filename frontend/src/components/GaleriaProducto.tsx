import { useEffect, useState, type KeyboardEvent } from 'react';
import { ProductoImagen } from '../components/ProductoImagen';
import { textoSeguro } from '../utils/format';

interface Props {
  imagenes: Array<{ id: number; url: string; texto_alternativo: string | null }>;
  nombreProducto: string;
}

/** Descarga anticipada controlada: sólo la imagen siguiente a la visible. */
function precargar(url: string | undefined) {
  const direccion = textoSeguro(url).trim();
  if (!direccion || typeof Image === 'undefined') return;
  const imagen = new Image();
  imagen.decoding = 'async';
  imagen.src = direccion;
}

/**
 * Galería con imagen principal, flechas, miniaturas seleccionables y teclado
 * (← → con el foco dentro de la galería). Con una sola imagen no se muestran
 * controles; sin imágenes, un sustituto. El marco mantiene proporción fija para
 * que cambiar de imagen no mueva el resto de la página.
 */
export function GaleriaProducto({ imagenes, nombreProducto }: Props) {
  const [indice, setIndice] = useState(0);
  const [animar, setAnimar] = useState(false);
  const total = imagenes.length;
  const posicionActual = total > 0 ? Math.min(indice, total - 1) : 0;
  const siguiente = imagenes[(posicionActual + 1) % Math.max(total, 1)];

  useEffect(() => {
    if (total > 1) precargar(siguiente?.url);
  }, [total, siguiente?.url]);

  if (total === 0) {
    return <div className="image-placeholder gallery-empty">Imagen no disponible</div>;
  }

  const imagenActual = imagenes[posicionActual] ?? imagenes[0];

  const cambiar = (destino: number) => {
    setIndice((destino + total) % total);
    setAnimar(true);
  };

  const alPulsarTecla = (evento: KeyboardEvent<HTMLElement>) => {
    if (total < 2) return;
    if (evento.key === 'ArrowLeft') {
      evento.preventDefault();
      cambiar(posicionActual - 1);
    } else if (evento.key === 'ArrowRight') {
      evento.preventDefault();
      cambiar(posicionActual + 1);
    }
  };

  return (
    <section
      className="gallery"
      aria-roledescription={total > 1 ? 'carrusel' : undefined}
      aria-label={`Imágenes de ${nombreProducto}`}
      onKeyDown={alPulsarTecla}
    >
      <div className="gallery-frame">
        <div className="gallery-image-layer">
          <ProductoImagen
            key={imagenActual.id}
            url={imagenActual.url}
            alt={textoSeguro(imagenActual.texto_alternativo, nombreProducto)}
            className={`product-main-image${animar ? ' gallery-image-enter' : ''}`}
            placeholderClassName="image-placeholder"
            prioritaria
            ancho={800}
            alto={600}
          />
        </div>
        {total > 1 ? (
          <>
            <button
              type="button"
              className="gallery-arrow gallery-previous"
              aria-label="Imagen anterior"
              onClick={() => cambiar(posicionActual - 1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="gallery-arrow gallery-next"
              aria-label="Imagen siguiente"
              onClick={() => cambiar(posicionActual + 1)}
            >
              ›
            </button>
            <span className="gallery-counter" aria-hidden="true">{posicionActual + 1} / {total}</span>
          </>
        ) : null}
      </div>
      {total > 1 ? (
        <>
          <p className="sr-only" role="status" aria-live="polite">
            Imagen {posicionActual + 1} de {total}
          </p>
          <ul className="gallery-thumbs" aria-label="Miniaturas">
            {imagenes.map((imagen, posicion) => {
              const activa = posicion === posicionActual;
              return (
                <li key={imagen.id}>
                  <button
                    type="button"
                    className={`gallery-thumb${activa ? ' active' : ''}`}
                    aria-label={`Ver imagen ${posicion + 1}`}
                    aria-current={activa ? 'true' : undefined}
                    onClick={() => cambiar(posicion)}
                  >
                    <ProductoImagen
                      url={imagen.url}
                      alt=""
                      className="gallery-thumb-image"
                      placeholderClassName="gallery-thumb-image gallery-thumb-fallback"
                      textoPlaceholder="—"
                      ancho={96}
                      alto={72}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </section>
  );
}
