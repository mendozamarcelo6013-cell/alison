import { useMemo, useState, type FormEvent } from 'react';
import {
  activarCategoriaAdmin,
  actualizarCategoriaAdmin,
  crearCategoriaAdmin,
  desactivarCategoriaAdmin,
} from '../../api/admin';
import { mensajeError } from '../../api/client';
import { Modal } from '../../components/admin/Modal';
import { construirArbol, categoriasParaSelector, idsDescendientes, type CategoriaNodo } from '../../utils/categorias';
import type { Categoria } from '../../types';

interface Props {
  categorias: Categoria[];
  onRecargar: () => Promise<void>;
  toast: (texto: string, tipo?: string) => void;
}

function FilaCategoria({
  nodo,
  onEditar,
  onCambiarEstado,
}: {
  nodo: CategoriaNodo;
  onEditar: (categoria: Categoria) => void;
  onCambiarEstado: (categoria: Categoria) => void;
}) {
  return (
    <div className={`admin-category-node admin-category-level-${nodo.parent_id == null ? 0 : 1}`}>
      <div className="admin-category-row">
        <div>
          <strong>{nodo.nombre}</strong>
          <span className="admin-category-meta">/{nodo.slug} · orden {nodo.orden ?? 0}</span>
        </div>
        <div className="admin-category-actions">
          <span className={`badge ${nodo.activa ? 'pub' : 'draft'}`}>{nodo.activa ? 'Activa' : 'Inactiva'}</span>
          <button type="button" className="mini-btn" onClick={() => onEditar(nodo)}>Editar</button>
          <button type="button" className="mini-btn danger" onClick={() => onCambiarEstado(nodo)}>
            {nodo.activa ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>
      {nodo.hijas.length ? (
        <div className="admin-category-children">
          {nodo.hijas.map((hija) => (
            <FilaCategoria key={hija.id} nodo={hija} onEditar={onEditar} onCambiarEstado={onCambiarEstado} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface FormularioProps {
  categoria: Categoria | null;
  categorias: Categoria[];
  onCerrar: () => void;
  onGuardado: () => Promise<void>;
  toast: (texto: string, tipo?: string) => void;
}

function FormularioCategoria({ categoria, categorias, onCerrar, onGuardado, toast }: FormularioProps) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? '');
  const [slug, setSlug] = useState(categoria?.slug ?? '');
  const [descripcion, setDescripcion] = useState(categoria?.descripcion ?? '');
  const [parentId, setParentId] = useState(categoria?.parent_id == null ? '' : String(categoria.parent_id));
  const [orden, setOrden] = useState(String(categoria?.orden ?? 0));
  const [activa, setActiva] = useState(categoria?.activa !== false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const editando = categoria?.id ?? null;
  const bloqueadas = useMemo(
    () => (editando === null ? new Set<number>() : idsDescendientes(categorias, editando)),
    [categorias, editando],
  );
  const opciones = categoriasParaSelector(categorias).filter(({ categoria: opcion }) => !bloqueadas.has(opcion.id));

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setError('');
    setGuardando(true);
    const payload = {
      nombre: nombre.trim(),
      slug: slug.trim(),
      descripcion: descripcion.trim() || null,
      parent_id: parentId === '' ? null : Number(parentId),
      orden: Number(orden),
      activa,
    };
    try {
      if (editando === null) await crearCategoriaAdmin(payload);
      else await actualizarCategoriaAdmin(editando, payload);
      toast(editando === null ? 'Categoría creada correctamente.' : 'Categoría actualizada correctamente.', 'ok');
      onCerrar();
      await onGuardado();
    } catch (errorGuardado) {
      setError(mensajeError(errorGuardado, 'No se pudo guardar la categoría.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal abierto onCerrar={onCerrar} id="category-modal-backdrop" labelledBy="category-modal-title" cerrarAlPulsarFondo cerrarAlEscape>
      <div className="modal-head">
        <h2 id="category-modal-title">{editando === null ? 'Nueva categoría' : `Editar: ${categoria?.nombre}`}</h2>
        <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onCerrar}>✕</button>
      </div>
      <form id="category-form" onSubmit={(evento) => void guardar(evento)}>
        <div className="form-grid">
          <label className="full">
            Nombre *
            <input required maxLength={100} value={nombre} onChange={(evento) => setNombre(evento.target.value)} />
          </label>
          <label>
            Slug *
            <input required maxLength={120} value={slug} onChange={(evento) => setSlug(evento.target.value)} placeholder="se-genera-al-crear" />
          </label>
          <label>
            Orden
            <input type="number" min="0" step="1" value={orden} onChange={(evento) => setOrden(evento.target.value)} />
          </label>
          <label className="full">
            Categoría padre
            <select value={parentId} onChange={(evento) => setParentId(evento.target.value)}>
              <option value="">— Categoría principal —</option>
              {opciones.map(({ categoria: opcion, nivel }) => (
                <option key={opcion.id} value={opcion.id} disabled={!opcion.activa}>
                  {`${'\u00a0\u00a0'.repeat(nivel)}${opcion.nombre}${opcion.activa ? '' : ' (inactiva)'}`}
                </option>
              ))}
            </select>
          </label>
          <label className="full">
            Descripción
            <textarea rows={4} value={descripcion} onChange={(evento) => setDescripcion(evento.target.value)} />
          </label>
          <label className="check full">
            <input type="checkbox" checked={activa} onChange={(evento) => setActiva(evento.target.checked)} />
            Categoría activa y visible
          </label>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar categoría'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function CategoriasAdminPanel({ categorias, onRecargar, toast }: Props) {
  const [editando, setEditando] = useState<Categoria | null | undefined>(undefined);

  const cambiarEstado = async (categoria: Categoria) => {
    try {
      if (categoria.activa) await desactivarCategoriaAdmin(categoria.id);
      else await activarCategoriaAdmin(categoria.id);
      toast(categoria.activa ? 'Categoría desactivada.' : 'Categoría activada.', 'ok');
      await onRecargar();
    } catch (errorEstado) {
      toast(mensajeError(errorEstado, 'No se pudo cambiar el estado de la categoría.'), 'error');
    }
  };

  return (
    <>
      <section className="wp-card category-admin-panel">
        <div className="category-admin-head">
          <div>
            <h2>Gestionar categorías</h2>
            <p className="muted">Organiza categorías principales y subcategorías sin modificar productos existentes.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setEditando(null)}>＋ Nueva categoría</button>
        </div>
        <div className="admin-category-list">
          {construirArbol(categorias).map((nodo) => (
            <FilaCategoria key={nodo.id} nodo={nodo} onEditar={setEditando} onCambiarEstado={(categoria) => void cambiarEstado(categoria)} />
          ))}
          {!categorias.length ? <p className="empty">No hay categorías registradas.</p> : null}
        </div>
      </section>
      {editando !== undefined ? (
        <FormularioCategoria
          categoria={editando}
          categorias={categorias}
          onCerrar={() => setEditando(undefined)}
          onGuardado={onRecargar}
          toast={toast}
        />
      ) : null}
    </>
  );
}
