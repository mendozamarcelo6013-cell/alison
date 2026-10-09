import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Modal } from '../../components/admin/Modal';
import {
  actualizarProductoAdmin,
  crearProductoAdmin,
  fijarImagenPrincipal,
  eliminarImagen,
  obtenerProductoAdmin,
  subirImagenes,
} from '../../api/admin';
import { mensajeError } from '../../api/client';
import type { Categoria, ProductoAdmin, ProductoImagen } from '../../types';

/** Límites del servidor: 12 archivos y PRODUCT_IMAGE_MAX_MB=5 (ver UI original). */
const MAX_ARCHIVOS = 12;
const MAX_BYTES = 5 * 1024 * 1024;
const MIME_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXTENSIONES = /\.(jpe?g|png|webp)$/i;

interface Props {
  producto: ProductoAdmin | null;
  categorias: Categoria[];
  onCerrar: () => void;
  onGuardado: () => Promise<void>;
  toast: (texto: string, tipo?: string) => void;
}

interface EntradaImagenNueva {
  file: File;
  preview: string;
}

export function ModalProducto({ producto, categorias, onCerrar, onGuardado, toast }: Props) {
  const editando = producto?.id ?? null;
  const stockOriginal = Number(producto?.stock ?? 0);

  const [nombre, setNombre] = useState(producto?.nombre ?? '');
  const [slug, setSlug] = useState(producto?.slug ?? '');
  const [sku, setSku] = useState(producto?.sku ?? '');
  const [categoriaId, setCategoriaId] = useState(producto?.categoria_id == null ? '' : String(producto.categoria_id));
  const [tipo, setTipo] = useState<string>(producto?.tipo ?? 'fisico');
  const [precio, setPrecio] = useState(producto?.precio === undefined ? '' : String(producto.precio));
  const [moneda, setMoneda] = useState(producto?.moneda ?? 'PEN');
  const [stock, setStock] = useState(String(producto?.stock ?? 0));
  const [motivo, setMotivo] = useState('');
  const [peso, setPeso] = useState(producto?.peso_gramos == null ? '' : String(producto.peso_gramos));
  const [descripcionCorta, setDescripcionCorta] = useState(producto?.descripcion_corta ?? '');
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? '');
  const [imagenUrl, setImagenUrl] = useState(producto?.imagenes?.find((imagen) => imagen.principal)?.url ?? producto?.imagenes?.[0]?.url ?? '');
  const [activo, setActivo] = useState(producto ? Boolean(producto.activo) : true);
  const [destacado, setDestacado] = useState(Boolean(producto?.destacado));
  const [controlaStock, setControlaStock] = useState(producto ? producto.controla_stock !== false : true);

  const [imagenesExistentes, setImagenesExistentes] = useState<ProductoImagen[]>(producto?.imagenes ?? []);
  const [imagenesNuevas, setImagenesNuevas] = useState<EntradaImagenNueva[]>([]);
  const [imagenPrincipalNueva, setImagenPrincipalNueva] = useState<number | null>(editando ? null : 0);

  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const motivoRef = useRef<HTMLInputElement>(null);
  const archivosRef = useRef<HTMLInputElement>(null);

  const refrescarImagenes = async (id: number) => {
    const detalle = await obtenerProductoAdmin(id);
    setImagenesExistentes(detalle.producto.imagenes ?? []);
    await onGuardado();
  };

  const usarComoPrincipal = async (imagen: ProductoImagen) => {
    if (!editando) return;
    try {
      await fijarImagenPrincipal(editando, imagen.id);
      toast('Imagen principal actualizada.', 'ok');
      await refrescarImagenes(editando);
    } catch (errorOp) {
      toast(mensajeError(errorOp, 'No se pudo actualizar la imagen principal.'), 'error');
    }
  };

  const quitarImagenExistente = async (imagen: ProductoImagen) => {
    if (!editando) return;
    try {
      await eliminarImagen(editando, imagen.id);
      toast('Imagen eliminada.', 'ok');
      await refrescarImagenes(editando);
    } catch (errorOp) {
      toast(mensajeError(errorOp, 'No se pudo eliminar la imagen.'), 'error');
    }
  };

  const seleccionarArchivos = (evento: ChangeEvent<HTMLInputElement>) => {
    const seleccionados = [...(evento.target.files ?? [])];
    imagenesNuevas.forEach((entrada) => URL.revokeObjectURL(entrada.preview));

    const rechazados: string[] = [];
    const validos: EntradaImagenNueva[] = [];

    seleccionados.forEach((file) => {
      if (validos.length >= MAX_ARCHIVOS) {
        rechazados.push(`${file.name}: máximo ${MAX_ARCHIVOS} imágenes por envío.`);
        return;
      }
      if (!MIME_PERMITIDOS.has(file.type) || !EXTENSIONES.test(file.name)) {
        rechazados.push(`${file.name}: solo se permiten imágenes JPG, JPEG, PNG o WEBP.`);
        return;
      }
      if (file.size > MAX_BYTES) {
        rechazados.push(`${file.name}: cada imagen debe pesar como máximo 5 MB.`);
        return;
      }
      validos.push({ file, preview: URL.createObjectURL(file) });
    });

    setImagenesNuevas(validos);
    setImagenPrincipalNueva(editando ? null : (validos.length ? 0 : null));
    setError(rechazados.length ? rechazados.join(' ') : '');
    if (archivosRef.current) archivosRef.current.value = '';
  };

  const quitarImagenNueva = (indice: number) => {
    setImagenesNuevas((previas) => {
      URL.revokeObjectURL(previas[indice].preview);
      const restantes = previas.filter((_, posicion) => posicion !== indice);
      setImagenPrincipalNueva((principal) => {
        if (principal === null) return null;
        if (!restantes.length) return null;
        return Math.min(principal, restantes.length - 1);
      });
      return restantes;
    });
  };

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();

    const stockNuevo = stock === '' ? 0 : Number(stock);
    if (editando && stockNuevo !== stockOriginal && !motivo.trim()) {
      setError('Indica el motivo del ajuste de stock (queda en bitácora y movimientos).');
      motivoRef.current?.focus();
      return;
    }

    const payload = {
      nombre: nombre.trim(),
      slug: slug.trim(),
      sku: sku.trim(),
      categoria_id: categoriaId === '' ? null : Number(categoriaId),
      tipo,
      precio: Number(precio),
      moneda: moneda.trim() || 'PEN',
      stock: stockNuevo,
      motivo_stock: motivo.trim() || undefined,
      peso_gramos: peso === '' ? null : Number(peso),
      descripcion_corta: descripcionCorta.trim() || null,
      descripcion: descripcion.trim() || null,
      imagen_url: imagenUrl.trim(),
      imagen_texto: nombre.trim(),
      activo,
      destacado,
      controla_stock: controlaStock,
    };

    setGuardando(true);
    setError('');
    try {
      let productoId = editando;
      if (editando) {
        await actualizarProductoAdmin(editando, payload);
        toast('Producto actualizado correctamente.', 'ok');
      } else {
        const resultado = await crearProductoAdmin(payload);
        productoId = resultado.producto.id;
        toast('Producto creado correctamente.', 'ok');
      }

      if (imagenesNuevas.length && productoId) {
        try {
          const formulario = new FormData();
          imagenesNuevas.forEach(({ file }) => formulario.append('imagenes', file));
          if (imagenPrincipalNueva !== null) {
            formulario.append('principal_index', String(imagenPrincipalNueva));
          }
          await subirImagenes(productoId, formulario);
        } catch (errorImagen) {
          setError(
            `Producto actualizado, pero no se pudieron subir las imágenes: ${mensajeError(errorImagen, '')}. Reinicia el servidor y vuelve a intentarlo.`,
          );
          return;
        }
      }

      onCerrar();
      await onGuardado();
    } catch (errorGuardado) {
      if (/No autenticado/i.test(mensajeError(errorGuardado, ''))) return;
      setError(mensajeError(errorGuardado, 'No se pudo guardar el producto.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      id="modal-backdrop"
      labelledBy="modal-title"
      cerrarAlPulsarFondo
      cerrarAlEscape
    >
      <div className="modal-head">
        <h2 id="modal-title">{editando ? `Editar: ${producto?.nombre}` : 'Añadir producto'}</h2>
        <button id="modal-close" className="icon-btn" type="button" aria-label="Cerrar" onClick={onCerrar}>
          ✕
        </button>
      </div>

      <form id="product-form" onSubmit={guardar}>
        <div className="form-grid">
          <label className="full">
            Nombre *
            <input
              id="f-nombre"
              required
              maxLength={180}
              placeholder="Ej. Laptop HP 15"
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
            />
          </label>
          <label>
            Slug <small>(auto si se deja vacío)</small>
            <input id="f-slug" placeholder="laptop-hp-15" value={slug} onChange={(evento) => setSlug(evento.target.value)} />
          </label>
          <label>
            SKU <small>(auto si se deja vacío)</small>
            <input id="f-sku" placeholder="LAPTOP-AB12" value={sku} onChange={(evento) => setSku(evento.target.value)} />
          </label>
          <label>
            Categoría
            <select id="f-categoria" value={categoriaId} onChange={(evento) => setCategoriaId(evento.target.value)}>
              <option value="">— Sin categoría —</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select id="f-tipo" value={tipo} onChange={(evento) => setTipo(evento.target.value)}>
              <option value="fisico">Físico</option>
              <option value="servicio">Servicio</option>
              <option value="digital">Digital</option>
            </select>
          </label>
          <label>
            Precio (S/) *
            <input
              id="f-precio"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="0.00"
              value={precio}
              onChange={(evento) => setPrecio(evento.target.value)}
            />
          </label>
          <label>
            Moneda
            <input id="f-moneda" maxLength={3} value={moneda} onChange={(evento) => setMoneda(evento.target.value)} />
          </label>
          <label>
            Stock
            <input id="f-stock" type="number" min="0" step="1" value={stock} onChange={(evento) => setStock(evento.target.value)} />
          </label>
          <label>
            Motivo del ajuste de stock <small>(obligatorio si cambias el stock)</small>
            <input
              id="f-motivo"
              ref={motivoRef}
              maxLength={500}
              placeholder="Ej. Inventario físico enero"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
            />
          </label>
          <label>
            Peso (gramos)
            <input
              id="f-peso"
              type="number"
              min="0"
              step="1"
              placeholder="Opcional"
              value={peso}
              onChange={(evento) => setPeso(evento.target.value)}
            />
          </label>
          <label className="full">
            Descripción corta
            <input
              id="f-desc-corta"
              maxLength={500}
              placeholder="Resumen para la tarjeta del catálogo"
              value={descripcionCorta}
              onChange={(evento) => setDescripcionCorta(evento.target.value)}
            />
          </label>
          <label className="full">
            Descripción
            <textarea
              id="f-desc"
              rows={4}
              placeholder="Descripción completa del producto"
              value={descripcion}
              onChange={(evento) => setDescripcion(evento.target.value)}
            />
          </label>
          <label className="full">
            Imagen principal (URL, opcional)
            <input
              id="f-imagen"
              type="url"
              placeholder="https://…"
              value={imagenUrl}
              onChange={(evento) => setImagenUrl(evento.target.value)}
            />
          </label>
          <label className="full">
            Imágenes del producto
            <input
              id="f-imagenes"
              ref={archivosRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={seleccionarArchivos}
            />
            <small>JPG, PNG o WEBP. Máximo 5 MB por imagen. Hasta {MAX_ARCHIVOS} por envío.</small>
          </label>

          <div id="f-imagenes-preview" className="image-list full" aria-live="polite">
            {imagenesExistentes.length ? (
              <p className="image-list-title">Imágenes guardadas</p>
            ) : null}
            {imagenesExistentes.map((imagen) => (
              <div className="image-list-item" key={`existente-${imagen.id}`}>
                <img src={imagen.url} alt={imagen.texto_alternativo || ''} />
                <span>{imagen.principal ? 'Portada' : `Imagen ${imagen.orden + 1}`}</span>
                <button
                  type="button"
                  className="mini-btn"
                  disabled={Boolean(imagen.principal)}
                  onClick={() => void usarComoPrincipal(imagen)}
                >
                  {imagen.principal ? 'Principal' : 'Usar como principal'}
                </button>
                <button type="button" className="mini-btn danger" onClick={() => void quitarImagenExistente(imagen)}>
                  Eliminar
                </button>
              </div>
            ))}
            {imagenesNuevas.map((entrada, indice) => (
              <div className="image-list-item new-image" key={`nueva-${indice}`}>
                <img src={entrada.preview} alt={entrada.file.name} />
                <label>
                  <input
                    type="radio"
                    name="new-main-image"
                    checked={imagenPrincipalNueva === indice}
                    onChange={() => setImagenPrincipalNueva(indice)}
                  />
                  {' '}Portada nueva
                </label>
                <button type="button" className="mini-btn danger" onClick={() => quitarImagenNueva(indice)}>
                  Quitar
                </button>
              </div>
            ))}
          </div>

          <div className="img-preview full">
            <img id="f-preview" src={imagenUrl.trim() || undefined} alt="Vista previa" hidden={!imagenUrl.trim()} />
            <span id="f-preview-empty" className="muted" hidden={Boolean(imagenUrl.trim())}>Sin vista previa</span>
          </div>

          <label className="check">
            <input type="checkbox" id="f-activo" checked={activo} onChange={(evento) => setActivo(evento.target.checked)} /> Publicado (visible en tienda)
          </label>
          <label className="check">
            <input type="checkbox" id="f-destacado" checked={destacado} onChange={(evento) => setDestacado(evento.target.checked)} /> Destacado
          </label>
          <label className="check">
            <input type="checkbox" id="f-controla" checked={controlaStock} onChange={(evento) => setControlaStock(evento.target.checked)} /> Controlar stock
          </label>
        </div>

        <p id="form-error" className="form-error" hidden={!error}>{error}</p>

        <div className="modal-foot">
          <button type="button" id="modal-cancel" className="btn btn-ghost" onClick={onCerrar}>Cancelar</button>
          <button type="submit" id="form-submit" className="btn btn-primary" disabled={guardando}>
            {editando ? 'Actualizar producto' : 'Guardar producto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
