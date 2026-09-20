/* Panel admin Horus Market — requiere token de rol admin (Bearer). */
const API = '/api/admin';
const TOKEN_KEY = 'horus_admin_token';
const state = {
  productos: [],
  paginacion: { total: 0, page: 1, limit: 10, totalPages: 1 },
  categorias: [],
  filtro: 'todos',
  categoriaId: '',
  busqueda: '',
  pagina: 1,
  porPagina: 10,
  seleccion: new Set(),
  editandoId: null,
  stockOriginal: 0,
  viendoId: null,
  pendienteEliminar: null,
  ultimoFoco: null,
  imagenesNuevas: [],
  imagenPrincipalNueva: null,
};

const $ = (id) => document.getElementById(id);
const tbody = $('tbody');
const toasts = $('toasts');

function toast(msg, tipo = '') {
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  toasts.append(el);
  setTimeout(() => el.remove(), 3800);
}

function texto(v, alt = '—') {
  return typeof v === 'string' && v.trim() ? v : (v ?? alt);
}

function moneda(n) {
  const num = Number(n);
  return Number.isFinite(num) ? `S/ ${num.toFixed(2)}` : '—';
}

function imagenPrincipal(p) {
  const imgs = Array.isArray(p.imagenes) ? p.imagenes : [];
  return imgs.find((i) => i.principal) || imgs[0] || null;
}

function fechaCorta(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getToken() { return sessionStorage.getItem(TOKEN_KEY) || ''; }
function setToken(t) { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); }

async function api(url, opciones = {}) {
  const esFormulario = opciones.body instanceof FormData;
  const res = await fetch(url, {
    ...opciones,
    headers: { ...(esFormulario ? {} : { 'Content-Type': 'application/json' }), ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}), ...(opciones.headers || {}) },
  });
  if (res.status === 401 || res.status === 403) {
    mostrarLogin('Sesión requerida o sin privilegios de administración.');
    throw new Error('No autenticado. Inicia sesión como administrador.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.mensaje || `Error HTTP ${res.status}`);
  }
  return data;
}

/* ---- Focus trap para modales ---- */
function atraparFoco(backdrop) {
  const modal = backdrop.querySelector('.modal');
  if (!modal) return () => {};
  const focos = () => [...modal.querySelectorAll('button, input, select, textarea, a[href]')].filter((el) => !el.disabled);
  function onKey(e) {
    if (e.key !== 'Tab') return;
    const lista = focos();
    if (!lista.length) return;
    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  }
  backdrop.addEventListener('keydown', onKey);
  return () => backdrop.removeEventListener('keydown', onKey);
}
let liberarFoco = () => {};
function abrirCapa(id) {
  state.ultimoFoco = document.activeElement;
  const capa = $(id);
  capa.hidden = false;
  liberarFoco();
  liberarFoco = atraparFoco(capa);
  const foco = capa.querySelector('input, select, textarea, button');
  if (foco) foco.focus();
}
function cerrarCapa(id) {
  $(id).hidden = true;
  liberarFoco();
  liberarFoco = () => {};
  if (state.ultimoFoco && document.contains(state.ultimoFoco)) state.ultimoFoco.focus();
}

/* ---- Login wall ---- */
function mostrarLogin(mensaje = '') {
  setToken('');
  $('user-email').hidden = true;
  $('btn-logout').hidden = true;
  if (mensaje) {
    const box = $('login-error');
    box.textContent = mensaje;
    box.hidden = false;
  }
  abrirCapa('login-backdrop');
}
function ocultarLogin() { cerrarCapa('login-backdrop'); }

async function hacerLogin(e) {
  e.preventDefault();
  const box = $('login-error');
  box.hidden = true;
  try {
    $('login-submit').disabled = true;
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('l-email').value.trim(), password: $('l-pass').value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.mensaje || 'No se pudo iniciar sesión.');
    setToken(data.token);
    $('l-pass').value = '';
    ocultarLogin();
    $('user-email').textContent = data.usuario?.email || '';
    $('user-email').hidden = false;
    $('btn-logout').hidden = false;
    toast('Sesión iniciada.', 'ok');
    await cargarTodo();
  } catch (err) {
    box.textContent = err.message;
    box.hidden = false;
  } finally {
    $('login-submit').disabled = false;
  }
}

/* ---- Listado con paginación del backend ---- */
function paramsListado() {
  const p = new URLSearchParams({
    page: String(state.pagina),
    limit: String(state.porPagina),
  });
  if (state.filtro === 'publicado' || state.filtro === 'borrador') p.set('estado', state.filtro);
  if (state.filtro === 'sinStock') p.set('sinStock', 'true');
  if (state.filtro === 'destacados') p.set('destacado', 'true');
  if (state.categoriaId) p.set('categoria_id', state.categoriaId);
  if (state.busqueda.trim()) p.set('search', state.busqueda.trim());
  return p.toString();
}

function renderTabla() {
  const items = state.productos;
  tbody.replaceChildren();
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.className = 'empty';
    td.textContent = 'Sin productos para este filtro. Prueba con “Todos” o añade uno nuevo.';
    tr.append(td);
    tbody.append(tr);
  }

  items.forEach((p) => {
    const tr = document.createElement('tr');

    const tdCheck = document.createElement('td');
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = state.seleccion.has(p.id);
    check.setAttribute('aria-label', `Seleccionar ${p.nombre}`);
    check.addEventListener('change', () => {
      if (check.checked) state.seleccion.add(p.id);
      else state.seleccion.delete(p.id);
      actualizarContador();
    });
    tdCheck.append(check);
    tr.append(tdCheck);

    const tdProd = document.createElement('td');
    const wrap = document.createElement('div');
    wrap.className = 'prod-cell';
    const img = imagenPrincipal(p);
    if (img?.url) {
      const el = document.createElement('img');
      el.className = 'prod-thumb';
      el.src = img.url;
      el.alt = '';
      el.loading = 'lazy';
      el.onerror = () => { el.replaceWith(placeholder()); };
      wrap.append(el);
    } else {
      wrap.append(placeholder());
    }
    const info = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'prod-name';
    name.textContent = texto(p.nombre, '(sin nombre)');
    name.addEventListener('click', () => verDetalle(p.id));
    const sub = document.createElement('div');
    sub.className = 'prod-sub';
    sub.textContent = `SKU: ${texto(p.sku)} · /${texto(p.slug)}`;
    const actions = document.createElement('div');
    actions.className = 'row-actions';
    actions.append(
      accion('Editar', () => editarProducto(p.id)),
      accion('Ver', () => verDetalle(p.id)),
      p.activo
        ? accion('A papelera', () => pedirEliminar(p.id, p.nombre), true)
        : accion('Restaurar', () => restaurar(p.id)),
    );
    info.append(name, sub, actions);
    wrap.append(info);
    tdProd.append(wrap);
    tr.append(tdProd);

    const tdCat = document.createElement('td');
    tdCat.textContent = texto(p.categoria?.nombre, 'Sin categoría');
    tr.append(tdCat);

    // Sin innerHTML: nodos + textContent.
    const tdPrecio = document.createElement('td');
    const strong = document.createElement('strong');
    strong.textContent = moneda(p.precio);
    const subPrecio = document.createElement('div');
    subPrecio.className = 'prod-sub';
    subPrecio.textContent = `${texto(p.moneda, 'PEN')} · ${texto(p.tipo)}`;
    tdPrecio.append(strong, subPrecio);
    tr.append(tdPrecio);

    const tdStock = document.createElement('td');
    const badgeStock = document.createElement('span');
    if (p.controla_stock === false) {
      badgeStock.className = 'badge stock-ok';
      badgeStock.textContent = '∞ Disponible';
    } else if (Number(p.stock) > 0) {
      badgeStock.className = 'badge stock-ok';
      badgeStock.textContent = `${p.stock} en stock`;
    } else {
      badgeStock.className = 'badge stock-out';
      badgeStock.textContent = 'Agotado';
    }
    tdStock.append(badgeStock);
    if (p.destacado) {
      tdStock.append(document.createElement('br'));
      const f = document.createElement('span');
      f.className = 'badge feat';
      f.textContent = '★ Destacado';
      tdStock.append(f);
    }
    tr.append(tdStock);

    const tdEstado = document.createElement('td');
    const b = document.createElement('span');
    b.className = `badge ${p.activo ? 'pub' : 'draft'}`;
    b.textContent = p.activo ? 'Publicado' : 'Borrador';
    tdEstado.append(b);
    tr.append(tdEstado);

    const tdFecha = document.createElement('td');
    tdFecha.textContent = fechaCorta(p.updatedAt || p.createdAt);
    tr.append(tdFecha);

    const tdAct = document.createElement('td');
    tdAct.className = 'col-actions';
    const btns = document.createElement('div');
    btns.className = 'action-btns';
    const bEdit = document.createElement('button');
    bEdit.className = 'mini-btn';
    bEdit.textContent = 'Editar';
    bEdit.addEventListener('click', () => editarProducto(p.id));
    btns.append(bEdit);
    if (p.activo) {
      const bDel = document.createElement('button');
      bDel.className = 'mini-btn danger';
      bDel.textContent = 'Papelera';
      bDel.addEventListener('click', () => pedirEliminar(p.id, p.nombre));
      btns.append(bDel);
    } else {
      const bRes = document.createElement('button');
      bRes.className = 'mini-btn';
      bRes.textContent = 'Restaurar';
      bRes.addEventListener('click', () => restaurar(p.id));
      btns.append(bRes);
    }
    tdAct.append(btns);
    tr.append(tdAct);

    tbody.append(tr);
  });

  const pg = state.paginacion;
  $('pagination-info').textContent = `${pg.total} elemento(s)`;
  $('page-info').textContent = `Página ${pg.page} de ${pg.totalPages}`;
  $('prev-page').disabled = pg.page <= 1;
  $('next-page').disabled = pg.page >= pg.totalPages;
  actualizarContador();
}

function placeholder() {
  const d = document.createElement('div');
  d.className = 'prod-thumb placeholder';
  d.textContent = '◍';
  return d;
}

function accion(label, fn, danger = false) {
  const b = document.createElement('button');
  b.textContent = label;
  if (danger) b.className = 'danger';
  b.addEventListener('click', fn);
  return b;
}

function actualizarContador() {
  $('count-label').textContent = state.seleccion.size ? `${state.seleccion.size} seleccionado(s)` : '';
  $('check-all').checked = state.productos.length > 0 && state.productos.every((p) => state.seleccion.has(p.id));
}

function pintarStats(stats) {
  $('stat-total').textContent = stats.total ?? '—';
  $('stat-pub').textContent = stats.publicados ?? '—';
  $('stat-draft').textContent = stats.borradores ?? '—';
  $('stat-nostock').textContent = stats.sinStock ?? '—';
  $('stat-feat').textContent = stats.destacados ?? '—';
}

function pintarCategorias() {
  const selFiltro = $('filter-category');
  const selForm = $('f-categoria');
  selFiltro.replaceChildren(new Option('Todas las categorías', ''));
  selForm.replaceChildren(new Option('— Sin categoría —', ''));
  state.categorias.forEach((c) => {
    selFiltro.append(new Option(`${c.nombre}${c.activa ? '' : ' (inactiva)'}`, c.id));
    selForm.append(new Option(c.nombre, c.id));
  });
  $('cat-count').textContent = state.categorias.length ? `(${state.categorias.length})` : '';
}

async function cargarTodo() {
  if (!getToken()) { mostrarLogin(); return; }
  $('api-status').textContent = '● Conectando…';
  $('api-status').className = 'api-status is-checking';
  try {
    const [dProd, dCat, dStats] = await Promise.all([
      api(`${API}/productos?${paramsListado()}`),
      state.categorias.length ? { categorias: state.categorias } : api(`${API}/categorias`),
      api(`${API}/stats`).catch(() => ({ stats: {} })),
    ]);
    state.productos = Array.isArray(dProd.productos) ? dProd.productos : [];
    state.paginacion = dProd.paginacion || { total: state.productos.length, page: 1, limit: 10, totalPages: 1 };
    state.categorias = Array.isArray(dCat.categorias) ? dCat.categorias : [];
    pintarCategorias();
    $('filter-category').value = state.categoriaId;
    if (dStats.stats) pintarStats(dStats.stats);
    renderTabla();
    $('api-status').textContent = '● En línea';
    $('api-status').className = 'api-status';
  } catch (e) {
    if (/No autenticado/i.test(e.message)) return;
    $('api-status').textContent = '● Sin conexión';
    $('api-status').className = 'api-status is-down';
    toast(e.message, 'error');
  }
}

async function cargarActividad() {
  try {
    const data = await api(`${API}/auditoria?limit=20`);
    const tb = $('activity-tbody');
    tb.replaceChildren();
    if (!data.registros?.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5; td.className = 'empty';
      td.textContent = data.aviso || 'Sin registros todavía.';
      tr.append(td); tb.append(tr);
      return;
    }
    data.registros.forEach((r) => {
      const tr = document.createElement('tr');
      [fechaCorta(r.createdAt), r.usuario_email || `#${r.usuario_id ?? '—'}`, r.accion, r.entidad_id ? `#${r.entidad_id}` : '—']
        .forEach((v) => { const td = document.createElement('td'); td.textContent = v; tr.append(td); });
      const tdDet = document.createElement('td');
      tdDet.textContent = r.detalle ? JSON.stringify(r.detalle).slice(0, 160) : '—';
      tr.append(tdDet);
      tb.append(tr);
    });
  } catch (e) {
    if (!/No autenticado/i.test(e.message)) toast(e.message, 'error');
  }
}

/* ---- Modal crear / editar ---- */
function abrirModal(producto = null) {
  state.editandoId = producto?.id ?? null;
  state.stockOriginal = Number(producto?.stock ?? 0);
  $('modal-title').textContent = producto ? `Editar: ${producto.nombre}` : 'Añadir producto';
  $('form-submit').textContent = producto ? 'Actualizar producto' : 'Guardar producto';
  $('form-error').hidden = true;
  $('f-id').value = producto?.id ?? '';
  $('f-nombre').value = producto?.nombre ?? '';
  $('f-slug').value = producto?.slug ?? '';
  $('f-sku').value = producto?.sku ?? '';
  $('f-categoria').value = producto?.categoria_id ?? '';
  $('f-tipo').value = producto?.tipo ?? 'fisico';
  $('f-precio').value = producto?.precio ?? '';
  $('f-moneda').value = producto?.moneda ?? 'PEN';
  $('f-stock').value = producto?.stock ?? 0;
  $('f-motivo').value = '';
  $('f-peso').value = producto?.peso_gramos ?? '';
  $('f-desc-corta').value = producto?.descripcion_corta ?? '';
  $('f-desc').value = producto?.descripcion ?? '';
  $('f-imagen').value = imagenPrincipal(producto ?? {})?.url ?? '';
  state.imagenesNuevas = [];
  state.imagenPrincipalNueva = producto ? null : 0;
  $('f-activo').checked = producto ? !!producto.activo : true;
  $('f-destacado').checked = !!producto?.destacado;
  $('f-controla').checked = producto ? producto.controla_stock !== false : true;
  actualizarPreview();
  renderizarImagenesExistentes(producto?.imagenes || []);
  renderizarImagenesNuevas();
  abrirCapa('modal-backdrop');
}

function renderizarImagenesExistentes(imagenes) {
  const contenedor = $('f-imagenes-preview');
  contenedor.replaceChildren();
  if (!imagenes.length) return;
  const titulo = document.createElement('p');
  titulo.className = 'image-list-title';
  titulo.textContent = 'Imágenes guardadas';
  contenedor.append(titulo);
  imagenes.forEach((imagen) => {
    const item = document.createElement('div');
    item.className = 'image-list-item';
    const img = document.createElement('img');
    img.src = imagen.url;
    img.alt = imagen.texto_alternativo || '';
    const info = document.createElement('span');
    info.textContent = imagen.principal ? 'Portada' : `Imagen ${imagen.orden + 1}`;
    const principal = document.createElement('button');
    principal.type = 'button';
    principal.className = 'mini-btn';
    principal.textContent = imagen.principal ? 'Principal' : 'Usar como principal';
    principal.disabled = !!imagen.principal;
    principal.addEventListener('click', async () => {
      try {
        await api(`${API}/productos/${state.editandoId}/imagenes/${imagen.id}/principal`, { method: 'PATCH' });
        toast('Imagen principal actualizada.', 'ok');
        const { producto } = await api(`${API}/productos/${state.editandoId}`);
        renderizarImagenesExistentes(producto.imagenes || []);
        await cargarTodo();
      } catch (error) { toast(error.message, 'error'); }
    });
    const eliminar = document.createElement('button');
    eliminar.type = 'button';
    eliminar.className = 'mini-btn danger';
    eliminar.textContent = 'Eliminar';
    eliminar.addEventListener('click', async () => {
      try {
        await api(`${API}/productos/${state.editandoId}/imagenes/${imagen.id}`, { method: 'DELETE' });
        toast('Imagen eliminada.', 'ok');
        const { producto } = await api(`${API}/productos/${state.editandoId}`);
        renderizarImagenesExistentes(producto.imagenes || []);
        await cargarTodo();
      } catch (error) { toast(error.message, 'error'); }
    });
    item.append(img, info, principal, eliminar);
    contenedor.append(item);
  });
}

function renderizarImagenesNuevas() {
  const contenedor = $('f-imagenes-preview');
  state.imagenesNuevas.forEach((entrada, indice) => {
    const item = document.createElement('div');
    item.className = 'image-list-item new-image';
    const img = document.createElement('img');
    img.src = entrada.preview;
    img.alt = entrada.file.name;
    const etiqueta = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'new-main-image';
    radio.checked = state.imagenPrincipalNueva === indice;
    radio.addEventListener('change', () => { state.imagenPrincipalNueva = indice; });
    etiqueta.append(radio, document.createTextNode(' Portada nueva'));
    const eliminar = document.createElement('button');
    eliminar.type = 'button';
    eliminar.className = 'mini-btn danger';
    eliminar.textContent = 'Quitar';
    eliminar.addEventListener('click', () => {
      URL.revokeObjectURL(entrada.preview);
      state.imagenesNuevas.splice(indice, 1);
      if (state.imagenPrincipalNueva !== null) {
        state.imagenPrincipalNueva = state.imagenesNuevas.length
          ? Math.min(state.imagenPrincipalNueva, state.imagenesNuevas.length - 1)
          : null;
      }
      renderizarImagenesNuevas();
    });
    item.append(img, etiqueta, eliminar);
    contenedor.append(item);
  });
}

async function editarProducto(id) {
  try {
    const { producto } = await api(`${API}/productos/${id}`);
    abrirModal(producto);
  } catch (error) {
    if (!/No autenticado/i.test(error.message)) toast(error.message, 'error');
  }
}

async function subirImagenesNuevas(productoId) {
  if (!state.imagenesNuevas.length) return;
  const formulario = new FormData();
  state.imagenesNuevas.forEach(({ file }) => formulario.append('imagenes', file));
  if (state.imagenPrincipalNueva !== null) formulario.append('principal_index', String(state.imagenPrincipalNueva));
  await api(`${API}/productos/${productoId}/imagenes`, { method: 'POST', body: formulario });
}

function actualizarPreview() {
  const url = $('f-imagen').value.trim();
  $('f-preview').hidden = !url;
  $('f-preview-empty').style.display = url ? 'none' : '';
  if (url) $('f-preview').src = url;
}

async function guardarFormulario(e) {
  e.preventDefault();
  const stockNuevo = $('f-stock').value === '' ? 0 : Number($('f-stock').value);
  const motivo = $('f-motivo').value.trim();
  if (state.editandoId && stockNuevo !== state.stockOriginal && !motivo) {
    const box = $('form-error');
    box.textContent = 'Indica el motivo del ajuste de stock (queda en bitácora y movimientos).';
    box.hidden = false;
    $('f-motivo').focus();
    return;
  }
  const payload = {
    nombre: $('f-nombre').value.trim(),
    slug: $('f-slug').value.trim(),
    sku: $('f-sku').value.trim(),
    categoria_id: $('f-categoria').value === '' ? null : Number($('f-categoria').value),
    tipo: $('f-tipo').value,
    precio: Number($('f-precio').value),
    moneda: $('f-moneda').value.trim() || 'PEN',
    stock: stockNuevo,
    motivo_stock: motivo || undefined,
    peso_gramos: $('f-peso').value === '' ? null : Number($('f-peso').value),
    descripcion_corta: $('f-desc-corta').value.trim() || null,
    descripcion: $('f-desc').value.trim() || null,
    imagen_url: $('f-imagen').value.trim(),
    imagen_texto: $('f-nombre').value.trim(),
    activo: $('f-activo').checked,
    destacado: $('f-destacado').checked,
    controla_stock: $('f-controla').checked,
  };
  try {
    $('form-submit').disabled = true;
    let productoId = state.editandoId;
    if (state.editandoId) {
      await api(`${API}/productos/${state.editandoId}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Producto actualizado correctamente.', 'ok');
    } else {
      const resultado = await api(`${API}/productos`, { method: 'POST', body: JSON.stringify(payload) });
      productoId = resultado.producto.id;
      toast('Producto creado correctamente.', 'ok');
    }
    try {
      await subirImagenesNuevas(productoId);
    } catch (error) {
      const box = $('form-error');
      box.textContent = `Producto actualizado, pero no se pudieron subir las imágenes: ${error.message}. Reinicia el servidor y vuelve a intentarlo.`;
      box.hidden = false;
      return;
    }
    cerrarCapa('modal-backdrop');
    await cargarTodo();
  } catch (err) {
    if (/No autenticado/i.test(err.message)) return;
    const box = $('form-error');
    box.textContent = err.message;
    box.hidden = false;
  } finally {
    $('form-submit').disabled = false;
  }
}

/* ---- Ver detalle ---- */
async function verDetalle(id) {
  try {
    const { producto: p } = await api(`${API}/productos/${id}`);
    state.viendoId = p.id;
    $('view-title').textContent = p.nombre;
    const img = imagenPrincipal(p);
    $('view-body').replaceChildren();
    if (img?.url) {
      const el = document.createElement('img');
      el.src = img.url;
      el.alt = p.nombre;
      $('view-body').append(el);
    }
    const dl = document.createElement('dl');
    dl.className = 'view-kv';
    const filas = [
      ['Estado', p.activo ? 'Publicado' : 'Borrador'],
      ['Precio', `${moneda(p.precio)} ${p.moneda || ''}`],
      ['Stock', p.controla_stock === false ? 'Sin control' : `${p.stock} uds.`],
      ['SKU', p.sku || '—'],
      ['Slug', p.slug || '—'],
      ['Categoría', p.categoria?.nombre || 'Sin categoría'],
      ['Tipo', p.tipo || '—'],
      ['Destacado', p.destacado ? 'Sí' : 'No'],
    ];
    filas.forEach(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      dl.append(dt, dd);
    });
    $('view-body').append(dl);
    if (p.descripcion_corta) {
      const parr = document.createElement('p');
      parr.textContent = p.descripcion_corta;
      $('view-body').append(parr);
    }
    const movs = Array.isArray(p.movimientosStock) ? p.movimientosStock : [];
    if (movs.length) {
      const h = document.createElement('h3');
      h.textContent = 'Últimos movimientos de stock';
      h.style.fontSize = '14px';
      $('view-body').append(h);
      const ul = document.createElement('ul');
      movs.slice(0, 5).forEach((m) => {
        const li = document.createElement('li');
        li.textContent = `${fechaCorta(m.createdAt)} · ${m.tipo} ${m.cantidad > 0 ? '+' : ''}${m.cantidad} → ${m.stock_resultante}${m.nota ? ` · ${m.nota}` : ''}`;
        ul.append(li);
      });
      $('view-body').append(ul);
    }
    abrirCapa('view-backdrop');
  } catch (e) {
    if (!/No autenticado/i.test(e.message)) toast(e.message, 'error');
  }
}

/* ---- Papelera / restaurar ---- */
function pedirEliminar(id, nombre) {
  state.pendienteEliminar = id;
  $('confirm-title').textContent = 'Enviar a papelera';
  $('confirm-text').textContent = `“${nombre || 'este producto'}” se despublicará y podrá restaurarse. No hay borrado definitivo por HTTP.`;
  abrirCapa('confirm-backdrop');
}

async function confirmarEliminar() {
  if (!state.pendienteEliminar) return;
  try {
    const { mensaje } = await api(`${API}/productos/${state.pendienteEliminar}`, { method: 'DELETE' });
    toast(mensaje || 'Producto enviado a papelera.', 'ok');
    state.seleccion.delete(state.pendienteEliminar);
    cerrarCapa('confirm-backdrop');
    await cargarTodo();
  } catch (e) {
    if (!/No autenticado/i.test(e.message)) toast(e.message, 'error');
  }
}

async function restaurar(id) {
  try {
    const { mensaje } = await api(`${API}/productos/${id}/restaurar`, { method: 'POST' });
    toast(mensaje || 'Producto restaurado.', 'ok');
    await cargarTodo();
  } catch (e) {
    if (!/No autenticado/i.test(e.message)) toast(e.message, 'error');
  }
}

async function aplicarBulk() {
  const accionSel = $('bulk-action').value;
  if (!accionSel) return toast('Elige una acción en lote.', 'error');
  if (!state.seleccion.size) return toast('Selecciona al menos un producto.', 'error');
  const ids = [...state.seleccion];
  try {
    if (accionSel === 'eliminar') {
      for (const id of ids) await api(`${API}/productos/${id}`, { method: 'DELETE' });
      toast(`${ids.length} producto(s) enviados a papelera.`, 'ok');
    } else if (accionSel === 'restaurar') {
      for (const id of ids) await api(`${API}/productos/${id}/restaurar`, { method: 'POST' });
      toast(`${ids.length} producto(s) restaurados.`, 'ok');
    } else {
      const mapa = {
        publicar: { activo: true },
        borrador: { activo: false },
        destacar: { destacado: true },
        'quitar-destacado': { destacado: false },
      };
      for (const id of ids) {
        await api(`${API}/productos/${id}`, { method: 'PUT', body: JSON.stringify({ ...mapa[accionSel], motivo_stock: 'Acción en lote desde panel' }) });
      }
      toast(`${ids.length} producto(s) actualizados.`, 'ok');
    }
    state.seleccion.clear();
    await cargarTodo();
  } catch (e) {
    if (!/No autenticado/i.test(e.message)) toast(e.message, 'error');
  }
}

function setFiltro(f) {
  if (f === 'actividad') {
    $('activity-section').hidden = false;
    cargarActividad();
    $('activity-section').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  $('activity-section').hidden = true;
  state.filtro = f;
  state.pagina = 1;
  document.querySelectorAll('#filter-links a').forEach((a) =>
    a.classList.toggle('current', a.dataset.filter === f));
  const titulos = {
    todos: 'Productos', publicado: 'Productos publicados',
    borrador: 'Borradores', sinStock: 'Productos sin stock', destacados: 'Productos destacados',
  };
  $('page-title').firstChild.textContent = `${titulos[f] || 'Productos'} `;
  cargarTodo();
}

/* ---- Eventos ---- */
let busquedaTimer = null;
function init() {
  // Añadir opción restaurar al bulk si no existe.
  const bulk = $('bulk-action');
  if (![...bulk.options].some((o) => o.value === 'restaurar')) {
    bulk.append(new Option('Restaurar (publicar papelera)', 'restaurar'));
  }

  $('login-form').addEventListener('submit', hacerLogin);
  $('btn-logout').addEventListener('click', () => { setToken(''); mostrarLogin('Sesión cerrada.'); });

  $('btn-refresh').addEventListener('click', cargarTodo);
  $('btn-new').addEventListener('click', () => abrirModal(null));
  document.querySelector('.title-action').addEventListener('click', () => abrirModal(null));
  $('modal-close').addEventListener('click', () => cerrarCapa('modal-backdrop'));
  $('modal-cancel').addEventListener('click', () => cerrarCapa('modal-backdrop'));
  $('modal-backdrop').addEventListener('click', (e) => { if (e.target === $('modal-backdrop')) cerrarCapa('modal-backdrop'); });
  $('product-form').addEventListener('submit', guardarFormulario);
  $('f-imagen').addEventListener('input', actualizarPreview);
  $('f-imagenes').addEventListener('change', (e) => {
    state.imagenesNuevas.forEach((entrada) => URL.revokeObjectURL(entrada.preview));
    state.imagenesNuevas = [...e.target.files].map((file) => ({ file, preview: URL.createObjectURL(file) }));
    state.imagenPrincipalNueva = state.editandoId ? null : 0;
    renderizarImagenesNuevas();
  });

  $('view-close').addEventListener('click', () => cerrarCapa('view-backdrop'));
  $('view-backdrop').addEventListener('click', (e) => { if (e.target === $('view-backdrop')) cerrarCapa('view-backdrop'); });
  $('view-edit').addEventListener('click', async () => {
    cerrarCapa('view-backdrop');
    try {
      const { producto } = await api(`${API}/productos/${state.viendoId}`);
      if (producto) abrirModal(producto);
    } catch (e) { if (!/No autenticado/i.test(e.message)) toast(e.message, 'error'); }
  });
  $('view-delete').addEventListener('click', () => {
    const p = state.productos.find((x) => x.id === state.viendoId);
    cerrarCapa('view-backdrop');
    if (p) pedirEliminar(p.id, p.nombre);
  });

  $('confirm-cancel').addEventListener('click', () => cerrarCapa('confirm-backdrop'));
  $('confirm-ok').addEventListener('click', confirmarEliminar);

  document.querySelectorAll('#filter-links a').forEach((a) =>
    a.addEventListener('click', (e) => { e.preventDefault(); setFiltro(a.dataset.filter); }));
  document.querySelectorAll('[data-view]').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const v = el.dataset.view;
      if (v === 'nuevo') return abrirModal(null);
      document.querySelectorAll('.submenu-item').forEach((s) => s.classList.toggle('active', s === el));
      setFiltro(v);
    }));

  $('filter-category').addEventListener('change', (e) => { state.categoriaId = e.target.value; state.pagina = 1; cargarTodo(); });
  $('search').addEventListener('input', (e) => {
    clearTimeout(busquedaTimer);
    busquedaTimer = setTimeout(() => { state.busqueda = e.target.value; state.pagina = 1; cargarTodo(); }, 350);
  });
  $('btn-search').addEventListener('click', () => { state.busqueda = $('search').value; state.pagina = 1; cargarTodo(); });
  $('btn-activity-refresh').addEventListener('click', cargarActividad);

  $('check-all').addEventListener('change', (e) => {
    if (e.target.checked) state.productos.forEach((p) => state.seleccion.add(p.id));
    else state.productos.forEach((p) => state.seleccion.delete(p.id));
    renderTabla();
  });
  $('btn-bulk').addEventListener('click', aplicarBulk);
  $('prev-page').addEventListener('click', () => { if (state.pagina > 1) { state.pagina -= 1; cargarTodo(); } });
  $('next-page').addEventListener('click', () => { state.pagina += 1; cargarTodo(); });

  $('menu-toggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));
  document.querySelector('.menu-group').addEventListener('click', function () {
    this.classList.toggle('is-open');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ['modal-backdrop', 'view-backdrop', 'confirm-backdrop'].forEach((id) => { if (!$(id).hidden) cerrarCapa(id); });
    }
  });

  if (!getToken()) mostrarLogin();
  else {
    api(`${API}/auth/me`).then((d) => {
      $('user-email').textContent = d.usuario?.email || '';
      $('user-email').hidden = false;
      $('btn-logout').hidden = false;
      cargarTodo();
    }).catch(() => mostrarLogin());
  }
}

document.addEventListener('DOMContentLoaded', init);
