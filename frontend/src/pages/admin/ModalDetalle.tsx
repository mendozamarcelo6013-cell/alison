import { Fragment } from 'react';
import { Modal } from '../../components/admin/Modal';
import { fechaCorta, monedaAdmin, textoColumna } from '../../utils/format';
import type { ProductoAdmin } from '../../types';

interface Props {
  producto: ProductoAdmin;
  onCerrar: () => void;
  onEditar: () => void;
  onPapelera: () => void;
}

/** Detalle rápido de un producto (modal de solo lectura + acciones). */
export function ModalDetalle({ producto, onCerrar, onEditar, onPapelera }: Props) {
  const imagen = (producto.imagenes || []).find((item) => item.principal) || producto.imagenes?.[0];
  const movimientos = Array.isArray(producto.movimientosStock) ? producto.movimientosStock : [];

  const filas: Array<[string, string]> = [
    ['Estado', producto.activo ? 'Publicado' : 'Borrador'],
    ['Precio', `${monedaAdmin(producto.precio)} ${producto.moneda || ''}`],
    ['Stock', producto.controla_stock === false ? 'Sin control' : `${producto.stock} uds.`],
    ['SKU', producto.sku || '—'],
    ['Slug', producto.slug || '—'],
    ['Categoría', producto.categoria?.nombre || 'Sin categoría'],
    ['Tipo', producto.tipo || '—'],
    ['Destacado', producto.destacado ? 'Sí' : 'No'],
  ];

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      id="view-backdrop"
      className="modal modal-sm"
      labelledBy="view-title"
      cerrarAlPulsarFondo
      cerrarAlEscape
    >
      <div className="modal-head">
        <h2 id="view-title">{producto.nombre}</h2>
        <button id="view-close" className="icon-btn" type="button" aria-label="Cerrar" onClick={onCerrar}>✕</button>
      </div>

      <div id="view-body" className="view-body">
        {imagen?.url ? <img src={imagen.url} alt={producto.nombre} /> : null}
        <dl className="view-kv">
          {filas.map(([clave, valor]) => (
            <Fragment key={clave}>
              <dt>{clave}</dt>
              <dd>{valor}</dd>
            </Fragment>
          ))}
        </dl>
        {producto.descripcion_corta ? <p>{producto.descripcion_corta}</p> : null}
        {movimientos.length ? (
          <>
            <h3 style={{ fontSize: '14px' }}>Últimos movimientos de stock</h3>
            <ul>
              {movimientos.slice(0, 5).map((movimiento) => (
                <li key={movimiento.id}>
                  {fechaCorta(movimiento.createdAt)}
                  {' · '}
                  {textoColumna(movimiento.tipo)}
                  {' '}
                  {movimiento.cantidad > 0 ? '+' : ''}
                  {movimiento.cantidad}
                  {' → '}
                  {movimiento.stock_resultante}
                  {movimiento.nota ? ` · ${movimiento.nota}` : ''}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <div className="modal-foot">
        <button id="view-delete" type="button" className="btn btn-danger-ghost" onClick={onPapelera}>
          Enviar a papelera
        </button>
        <button id="view-edit" type="button" className="btn btn-primary" onClick={onEditar}>
          Editar
        </button>
      </div>
    </Modal>
  );
}
