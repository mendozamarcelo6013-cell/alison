import { useState } from 'react';
import { fechaCorta, monedaAdmin } from '../../utils/format';
import type { ProductoAdmin } from '../../types';

/** `texto()` del panel: cadena con contenido → tal cual; vacío/nulo → alternativa. */
function texto(valor: unknown, alternativa = '—'): string {
  if (typeof valor === 'string' && valor.trim()) return valor;
  return valor == null ? alternativa : String(valor);
}

function ThumbProducto({ url }: { url?: string }) {
  const [roto, setRoto] = useState(false);
  if (!url || roto) return <div className="prod-thumb placeholder">◍</div>;
  return (
    <img
      className="prod-thumb"
      src={url}
      alt=""
      loading="lazy"
      onError={() => setRoto(true)}
    />
  );
}

interface Props {
  productos: ProductoAdmin[];
  seleccion: Set<number>;
  cargando: boolean;
  onCambiarSeleccion: (id: number, marcado: boolean) => void;
  onSeleccionarTodos: (marcado: boolean) => void;
  onEditar: (id: number) => void;
  onVer: (id: number) => void;
  onPapelera: (id: number, nombre: string) => void;
  onRestaurar: (id: number) => void;
}

export function TablaProductos({
  productos,
  seleccion,
  cargando,
  onCambiarSeleccion,
  onSeleccionarTodos,
  onEditar,
  onVer,
  onPapelera,
  onRestaurar,
}: Props) {
  const vacio = (
    <tr>
      <td colSpan={8} className="empty">
        Sin productos para este filtro. Prueba con “Todos” o añade uno nuevo.
      </td>
    </tr>
  );

  return (
    <div className="table-wrap">
      <table className="wp-table">
        <thead>
          <tr>
            <th className="col-check">
              <input
                type="checkbox"
                id="check-all"
                aria-label="Seleccionar todos"
                checked={productos.length > 0 && productos.every((p) => seleccion.has(p.id))}
                onChange={(evento) => onSeleccionarTodos(evento.target.checked)}
              />
            </th>
            <th>Producto</th>
            <th>Categoría</th>
            <th>Precio</th>
            <th>Stock</th>
            <th>Estado</th>
            <th>Fecha</th>
            <th className="col-actions">Acciones</th>
          </tr>
        </thead>
        <tbody id="tbody">
          {cargando && !productos.length ? (
            <tr><td colSpan={8} className="empty">Cargando productos…</td></tr>
          ) : productos.length === 0 ? (
            vacio
          ) : (
            productos.map((p) => {
              const imagenes = Array.isArray(p.imagenes) ? p.imagenes : [];
              const imagen = imagenes.find((i) => i.principal) || imagenes[0] || null;
              return (
                <tr key={p.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={seleccion.has(p.id)}
                      aria-label={`Seleccionar ${p.nombre}`}
                      onChange={(evento) => onCambiarSeleccion(p.id, evento.target.checked)}
                    />
                  </td>
                  <td>
                    <div className="prod-cell">
                      <ThumbProducto url={imagen?.url} />
                      <div>
                        <div className="prod-name" onClick={() => onVer(p.id)}>
                          {texto(p.nombre, '(sin nombre)')}
                        </div>
                        <div className="prod-sub">
                          SKU: {texto(p.sku)} · /{texto(p.slug)}
                        </div>
                        <div className="row-actions">
                          <button onClick={() => onEditar(p.id)}>Editar</button>
                          <button onClick={() => onVer(p.id)}>Ver</button>
                          {p.activo ? (
                            <button className="danger" onClick={() => onPapelera(p.id, p.nombre)}>
                              A papelera
                            </button>
                          ) : (
                            <button onClick={() => onRestaurar(p.id)}>Restaurar</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{texto(p.categoria?.nombre, 'Sin categoría')}</td>
                  <td>
                    <strong>{monedaAdmin(p.precio)}</strong>
                    <div className="prod-sub">{texto(p.moneda, 'PEN')} · {texto(p.tipo)}</div>
                  </td>
                  <td>
                    <span className={`badge ${p.controla_stock === false || Number(p.stock) > 0 ? 'stock-ok' : 'stock-out'}`}>
                      {p.controla_stock === false
                        ? '∞ Disponible'
                        : (Number(p.stock) > 0 ? `${p.stock} en stock` : 'Agotado')}
                    </span>
                    {p.destacado ? (
                      <>
                        <br />
                        <span className="badge feat">★ Destacado</span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    <span className={`badge ${p.activo ? 'pub' : 'draft'}`}>
                      {p.activo ? 'Publicado' : 'Borrador'}
                    </span>
                  </td>
                  <td>{fechaCorta(p.updatedAt || p.createdAt)}</td>
                  <td className="col-actions">
                    <div className="action-btns">
                      <button className="mini-btn" onClick={() => onEditar(p.id)}>Editar</button>
                      {p.activo ? (
                        <button className="mini-btn danger" onClick={() => onPapelera(p.id, p.nombre)}>
                          Papelera
                        </button>
                      ) : (
                        <button className="mini-btn" onClick={() => onRestaurar(p.id)}>Restaurar</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
