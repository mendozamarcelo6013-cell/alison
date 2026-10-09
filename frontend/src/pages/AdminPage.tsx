import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TOKEN_KEY,
  actualizarProductoAdmin,
  configurarAdminApi,
  enviarAPapelera,
  guardarTokenAdmin,
  iniciarSesion,
  listarAuditoriaAdmin,
  listarCategoriasAdmin,
  listarProductosAdmin,
  obtenerEstadisticas,
  obtenerProductoAdmin,
  restaurarProducto,
  verificarSesion,
  type FiltrosListado,
  type PayloadProductoAdmin,
} from '../api/admin';
import { mensajeError } from '../api/client';
import { useToasts } from '../hooks/useToasts';
import { fechaCorta } from '../utils/format';
import { ModalDetalle } from './admin/ModalDetalle';
import { ModalConfirmacion } from './admin/ModalConfirmacion';
import { ModalLogin } from './admin/ModalLogin';
import { ModalProducto } from './admin/ModalProducto';
import { TablaProductos } from './admin/TablaProductos';
import type { Categoria, EstadisticasAdmin, Paginacion, ProductoAdmin, RegistroAuditoria } from '../types';
import logoHorus from '../../../public/assets/logo-horus.png';
import '../../../public/css/admin.css';

const POR_PAGINA = 10;

type Filtro = 'todos' | 'publicado' | 'borrador' | 'sinStock' | 'destacados';
type Modo = 'ninguno' | 'producto' | 'detalle' | 'confirmar' | 'login';
type EstadoApi = 'check' | 'online' | 'down';

const FILTROS: Filtro[] = ['todos', 'publicado', 'borrador', 'sinStock', 'destacados'];

const TITULOS: Record<Filtro, string> = {
  todos: 'Productos',
  publicado: 'Productos publicados',
  borrador: 'Borradores',
  sinStock: 'Productos sin stock',
  destacados: 'Productos destacados',
};

const ETIQUETAS: Record<Filtro, string> = {
  todos: 'Todos',
  publicado: 'Publicados',
  borrador: 'Borradores',
  sinStock: 'Sin stock',
  destacados: 'Destacados',
};

const PAGINACION_VACIA: Paginacion = { total: 0, page: 1, limit: POR_PAGINA, totalPages: 1 };

export function AdminPage() {
  const { avisos, toast } = useToasts();

  const [autenticado, setAutenticado] = useState(false);
  const [emailUsuario, setEmailUsuario] = useState('');
  const [mensajeLogin, setMensajeLogin] = useState('');

  const [productos, setProductos] = useState<ProductoAdmin[]>([]);
  const [paginacion, setPaginacion] = useState<Paginacion>(PAGINACION_VACIA);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [stats, setStats] = useState<EstadisticasAdmin>({});
  const [datosListos, setDatosListos] = useState(false);

  const [filtro, setFiltroEstado] = useState<Filtro>('todos');
  const [categoriaId, setCategoriaId] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [busquedaInput, setBusquedaInput] = useState('');
  const [pagina, setPagina] = useState(1);
  const [seleccion, setSeleccion] = useState<Set<number>>(() => new Set());

  const [estadoApi, setEstadoApi] = useState<EstadoApi>('check');
  const [modo, setModo] = useState<Modo>('ninguno');
  const [productoEditar, setProductoEditar] = useState<ProductoAdmin | null>(null);
  const [productoDetalle, setProductoDetalle] = useState<ProductoAdmin | null>(null);
  const [pendiente, setPendiente] = useState<{ id: number; nombre: string } | null>(null);

  const [actividadVisible, setActividadVisible] = useState(false);
  const [rondaActividad, setRondaActividad] = useState(0);
  const [actividad, setActividad] = useState<RegistroAuditoria[] | null>(null);
  const [avisoActividad, setAvisoActividad] = useState('');

  const [sidebarAbierta, setSidebarAbierta] = useState(false);
  const [submenuAbierto, setSubmenuAbierto] = useState(true);
  const [accionBulk, setAccionBulk] = useState('');

  const categoriasRef = useRef<Categoria[]>([]);
  const avisarSesionRef = useRef<() => void>(() => {});
  const seccionActividadRef = useRef<HTMLElement>(null);

  const mostrarLogin = useCallback((mensaje = '') => {
    guardarTokenAdmin('');
    setAutenticado(false);
    setEmailUsuario('');
    setMensajeLogin((anterior) => mensaje || anterior);
    setModo('login');
  }, []);

  avisarSesionRef.current = () => mostrarLogin('Sesión requerida o sin privilegios de administración.');

  /* ---- Arranque: proveedor HTTP admin + comprobación de sesión ---- */
  useEffect(() => {
    configurarAdminApi({
      leerToken: () => sessionStorage.getItem(TOKEN_KEY) || '',
      notificarNoAutenticado: () => avisarSesionRef.current(),
    });

    if (!obtenerToken()) {
      mostrarLogin();
      return;
    }
    verificarSesion()
      .then((respuesta) => {
        setEmailUsuario(respuesta.usuario?.email || '');
        setAutenticado(true);
      })
      .catch(() => mostrarLogin());
  }, []);

  /* ---- Listado con paginación del backend ---- */
  const cargarTodo = useCallback(async () => {
    if (!obtenerToken()) {
      mostrarLogin();
      return;
    }
    setEstadoApi('check');
    try {
      const filtros: FiltrosListado = { page: pagina, limit: POR_PAGINA };
      if (filtro === 'publicado' || filtro === 'borrador') filtros.estado = filtro;
      if (filtro === 'sinStock') filtros.sinStock = true;
      if (filtro === 'destacados') filtros.destacado = true;
      if (categoriaId) filtros.categoriaId = categoriaId;
      if (busqueda.trim()) filtros.busqueda = busqueda;

      const peticionCategorias = categoriasRef.current.length
        ? Promise.resolve({ ok: true as const, categorias: categoriasRef.current })
        : listarCategoriasAdmin();

      const [dProd, dCat, dStats] = await Promise.all([
        listarProductosAdmin(filtros),
        peticionCategorias,
        obtenerEstadisticas().catch(() => null),
      ]);

      const items = Array.isArray(dProd.productos) ? dProd.productos : [];
      setProductos(items);
      setPaginacion(dProd.paginacion || { ...PAGINACION_VACIA, total: items.length });
      categoriasRef.current = Array.isArray(dCat.categorias) ? dCat.categorias : [];
      setCategorias(categoriasRef.current);
      if (dStats?.stats) setStats(dStats.stats);
      setDatosListos(true);
      setEstadoApi('online');
    } catch (error) {
      if (/No autenticado/i.test(mensajeError(error, ''))) return;
      setEstadoApi('down');
      toast(mensajeError(error, 'No se pudo cargar el listado.'), 'error');
    }
  }, [pagina, filtro, categoriaId, busqueda, mostrarLogin, toast]);

  useEffect(() => {
    if (!autenticado) return;
    void cargarTodo();
  }, [autenticado, cargarTodo]);

  /* ---- Búsqueda con retardo de 350 ms ---- */
  useEffect(() => {
    const temporizador = setTimeout(() => {
      setBusqueda((anterior) => (anterior === busquedaInput ? anterior : busquedaInput));
      setPagina((anterior) => (anterior === 1 ? anterior : 1));
    }, 350);
    return () => clearTimeout(temporizador);
  }, [busquedaInput]);

  /* ---- Actividad reciente ---- */
  const cargarActividad = useCallback(async () => {
    try {
      const data = await listarAuditoriaAdmin(20);
      setActividad(Array.isArray(data.registros) ? data.registros : []);
      setAvisoActividad(data.aviso ?? '');
    } catch (error) {
      if (!/No autenticado/i.test(mensajeError(error, ''))) {
        toast(mensajeError(error, 'No se pudo cargar la actividad.'), 'error');
      }
    }
  }, [toast]);

  useEffect(() => {
    if (!actividadVisible || rondaActividad === 0) return;
    seccionActividadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    void cargarActividad();
  }, [rondaActividad, actividadVisible, cargarActividad]);

  /* ---- Acciones ---- */
  const abrirNuevo = () => {
    setProductoEditar(null);
    setModo('producto');
  };

  const editarProducto = async (id: number) => {
    try {
      const { producto } = await obtenerProductoAdmin(id);
      setProductoEditar(producto);
      setModo('producto');
    } catch (error) {
      if (!/No autenticado/i.test(mensajeError(error, ''))) toast(mensajeError(error, ''), 'error');
    }
  };

  const verDetalle = async (id: number) => {
    try {
      const { producto } = await obtenerProductoAdmin(id);
      setProductoDetalle(producto);
      setModo('detalle');
    } catch (error) {
      if (!/No autenticado/i.test(mensajeError(error, ''))) toast(mensajeError(error, ''), 'error');
    }
  };

  const editarDesdeDetalle = async () => {
    if (!productoDetalle) return;
    const id = productoDetalle.id;
    setModo('ninguno');
    try {
      const { producto } = await obtenerProductoAdmin(id);
      if (producto) {
        setProductoEditar(producto);
        setModo('producto');
      }
    } catch (error) {
      if (!/No autenticado/i.test(mensajeError(error, ''))) toast(mensajeError(error, ''), 'error');
    }
  };

  const papeleraDesdeDetalle = () => {
    const actual = productoDetalle;
    setModo('ninguno');
    if (!actual) return;
    const enTabla = productos.find((x) => x.id === actual.id);
    if (enTabla) pedirEliminar(enTabla.id, enTabla.nombre);
  };

  const pedirEliminar = (id: number, nombre: string) => {
    setPendiente({ id, nombre });
    setModo('confirmar');
  };

  const confirmarEliminar = async () => {
    if (!pendiente) return;
    try {
      const { mensaje } = await enviarAPapelera(pendiente.id);
      toast(mensaje || 'Producto enviado a papelera.', 'ok');
      setSeleccion((anterior) => {
        const copia = new Set(anterior);
        copia.delete(pendiente.id);
        return copia;
      });
      setModo('ninguno');
      await cargarTodo();
    } catch (error) {
      if (!/No autenticado/i.test(mensajeError(error, ''))) toast(mensajeError(error, ''), 'error');
    }
  };

  const restaurar = async (id: number) => {
    try {
      const { mensaje } = await restaurarProducto(id);
      toast(mensaje || 'Producto restaurado.', 'ok');
      await cargarTodo();
    } catch (error) {
      if (!/No autenticado/i.test(mensajeError(error, ''))) toast(mensajeError(error, ''), 'error');
    }
  };

  const aplicarBulk = async () => {
    if (!accionBulk) {
      toast('Elige una acción en lote.', 'error');
      return;
    }
    if (!seleccion.size) {
      toast('Selecciona al menos un producto.', 'error');
      return;
    }
    const ids = [...seleccion];
    try {
      if (accionBulk === 'eliminar') {
        for (const id of ids) await enviarAPapelera(id);
        toast(`${ids.length} producto(s) enviados a papelera.`, 'ok');
      } else if (accionBulk === 'restaurar') {
        for (const id of ids) await restaurarProducto(id);
        toast(`${ids.length} producto(s) restaurados.`, 'ok');
      } else {
        const mapa: Record<string, Partial<PayloadProductoAdmin>> = {
          publicar: { activo: true },
          borrador: { activo: false },
          destacar: { destacado: true },
          'quitar-destacado': { destacado: false },
        };
        for (const id of ids) {
          await actualizarProductoAdmin(id, {
            ...mapa[accionBulk],
            motivo_stock: 'Acción en lote desde panel',
          });
        }
        toast(`${ids.length} producto(s) actualizados.`, 'ok');
      }
      setSeleccion(new Set());
      await cargarTodo();
    } catch (error) {
      if (!/No autenticado/i.test(mensajeError(error, ''))) toast(mensajeError(error, ''), 'error');
    }
  };

  const cambiarSeleccion = (id: number, marcado: boolean) => {
    setSeleccion((anterior) => {
      const copia = new Set(anterior);
      if (marcado) copia.add(id);
      else copia.delete(id);
      return copia;
    });
  };

  const seleccionarTodos = (marcado: boolean) => {
    setSeleccion((anterior) => {
      const copia = new Set(anterior);
      productos.forEach((p) => {
        if (marcado) copia.add(p.id);
        else copia.delete(p.id);
      });
      return copia;
    });
  };

  const aplicarFiltro = (destino: Filtro | 'actividad') => {
    if (destino === 'actividad') {
      setActividadVisible(true);
      setRondaActividad((n) => n + 1);
      return;
    }
    setActividadVisible(false);
    setFiltroEstado(destino);
    setPagina(1);
  };

  const alIniciarSesion = async (email: string, password: string) => {
    try {
      const data = await iniciarSesion(email, password);
      guardarTokenAdmin(data.token);
      setEmailUsuario(data.usuario?.email || '');
      setMensajeLogin('');
      setAutenticado(true);
      setModo('ninguno');
      toast('Sesión iniciada.', 'ok');
    } catch (error) {
      const texto = mensajeError(error, 'No se pudo iniciar sesión.');
      throw new Error(/^Error HTTP\b/.test(texto) ? 'No se pudo iniciar sesión.' : texto);
    }
  };

  const cerrarSesion = () => {
    guardarTokenAdmin('');
    mostrarLogin('Sesión cerrada.');
  };

  /* ---- Derivadas de render ---- */
  const etiquetaApi = estadoApi === 'check'
    ? '● Conectando…'
    : (estadoApi === 'down' ? '● Sin conexión' : '● En línea');
  const claseApi = estadoApi === 'check'
    ? 'api-status is-checking'
    : (estadoApi === 'down' ? 'api-status is-down' : 'api-status');

  const conteoSeleccion = seleccion.size ? `${seleccion.size} seleccionado(s)` : '';

  return (
    <>
      <header className="wp-topbar">
        <div className="wp-topbar-left">
          <button
            id="menu-toggle"
            className="icon-btn"
            type="button"
            aria-label="Mostrar u ocultar menú"
            onClick={() => setSidebarAbierta((abierta) => !abierta)}
          >
            ☰
          </button>
          <a className="wp-brand" href="admin.html" aria-label="Horus Market, administración">
            <span className="wp-logo" aria-hidden="true">
              <img src={logoHorus} alt="" />
            </span>
            <span className="brand-text">
              <strong>Horus Group</strong>
              <span>Market · Panel <em>Admin</em></span>
            </span>
          </a>
        </div>
        <div className="wp-topbar-right">
          <span id="api-status" className={claseApi}>{etiquetaApi}</span>
          <span id="user-email" className="topbar-user" hidden={!autenticado}>{emailUsuario}</span>
          <a className="topbar-link" href="market.html" target="_blank" rel="noopener">↗ Ver tienda</a>
          <button id="btn-logout" className="topbar-link topbar-btn" type="button" hidden={!autenticado} onClick={cerrarSesion}>
            Cerrar sesión
          </button>
          <span className="wp-avatar" title="Administrador">A</span>
        </div>
      </header>

      <div className="wp-shell">
        <aside id="sidebar" className={`wp-sidebar${sidebarAbierta ? ' open' : ''}`}>
          <p className="menu-caption">Panel de control</p>
          <nav aria-label="Menú de administración">
            <a href="admin.html" className="menu-item active"><span className="dashicon">◈</span> Escritorio</a>
            <button
              type="button"
              className={`menu-group${submenuAbierto ? ' is-open' : ''}`}
              data-group="productos"
              onClick={() => setSubmenuAbierto((abierto) => !abierto)}
            >
              <span><span className="dashicon">▦</span> Productos</span><span className="caret">▾</span>
            </button>
            <div className="submenu" id="submenu-productos">
              <a
                href="#"
                className={`submenu-item${filtro === 'todos' ? ' active' : ''}`}
                data-view="todos"
                onClick={(evento) => { evento.preventDefault(); aplicarFiltro('todos'); }}
              >
                Todos los productos
              </a>
              <a
                href="#"
                className="submenu-item"
                data-view="nuevo"
                onClick={(evento) => { evento.preventDefault(); abrirNuevo(); }}
              >
                Añadir nuevo
              </a>
              <a
                href="#"
                className={`submenu-item${filtro === 'publicado' ? ' active' : ''}`}
                data-view="publicado"
                onClick={(evento) => { evento.preventDefault(); aplicarFiltro('publicado'); }}
              >
                Publicados
              </a>
              <a
                href="#"
                className={`submenu-item${filtro === 'borrador' ? ' active' : ''}`}
                data-view="borrador"
                onClick={(evento) => { evento.preventDefault(); aplicarFiltro('borrador'); }}
              >
                Borradores
              </a>
            </div>
            <a href="market.html" className="menu-item">
              <span className="dashicon">◉</span> Categorías <small id="cat-count">{categorias.length ? `(${categorias.length})` : ''}</small>
            </a>
            <a
              href="#"
              className="menu-item"
              data-view="sinStock"
              onClick={(evento) => { evento.preventDefault(); aplicarFiltro('sinStock'); }}
            >
              <span className="dashicon">⚠</span> Sin stock
            </a>
            <a
              href="#"
              className="menu-item"
              data-view="destacados"
              onClick={(evento) => { evento.preventDefault(); aplicarFiltro('destacados'); }}
            >
              <span className="dashicon">★</span> Destacados
            </a>
            <a
              href="#"
              className="menu-item"
              data-view="actividad"
              onClick={(evento) => { evento.preventDefault(); aplicarFiltro('actividad'); }}
            >
              <span className="dashicon">☰</span> Actividad
            </a>
            <hr />
            <a className="menu-item muted" href="/api/admin/stats" target="_blank" rel="noopener">
              <span className="dashicon">≋</span> API / Stats
            </a>
            <a className="menu-item muted" href="market-carrito.html"><span className="dashicon">☷</span> Ver carrito</a>
          </nav>
          <div className="sidebar-foot">
            <p>Horus Group · Market Lab</p>
            <p className="muted">CRUD: crear · leer · actualizar · eliminar</p>
          </div>
        </aside>

        <main className="wp-content">
          <div className="page-head">
            <div>
              <p className="eyebrow">Horus Group · Market</p>
              <h1 id="page-title">
                {TITULOS[filtro]}{' '}
                <span className="title-action" onClick={abrirNuevo}>Añadir nuevo</span>
              </h1>
              <p className="page-sub" id="page-sub">Gestiona el catálogo de la tienda desde este panel.</p>
            </div>
            <div className="page-actions">
              <button id="btn-refresh" className="btn btn-ghost" type="button" onClick={() => void cargarTodo()}>
                ⟳ Recargar
              </button>
              <button id="btn-new" className="btn btn-primary" type="button" onClick={abrirNuevo}>
                ＋ Añadir producto
              </button>
            </div>
          </div>

          <section className="stats-grid" aria-label="Resumen">
            <article className="stat-card">
              <span className="stat-label">Total</span>
              <strong id="stat-total">{stats.total ?? '—'}</strong>
              <span className="stat-hint">productos registrados</span>
            </article>
            <article className="stat-card green">
              <span className="stat-label">Publicados</span>
              <strong id="stat-pub">{stats.publicados ?? '—'}</strong>
              <span className="stat-hint">visibles en tienda</span>
            </article>
            <article className="stat-card amber">
              <span className="stat-label">Borradores</span>
              <strong id="stat-draft">{stats.borradores ?? '—'}</strong>
              <span className="stat-hint">ocultos / papelera</span>
            </article>
            <article className="stat-card red">
              <span className="stat-label">Sin stock</span>
              <strong id="stat-nostock">{stats.sinStock ?? '—'}</strong>
              <span className="stat-hint">requieren reposición</span>
            </article>
            <article className="stat-card blue">
              <span className="stat-label">Destacados</span>
              <strong id="stat-feat">{stats.destacados ?? '—'}</strong>
              <span className="stat-hint">prioridad en catálogo</span>
            </article>
          </section>

          <section className="wp-card">
            <div className="tablenav top">
              <ul className="subsubsub" id="filter-links">
                {FILTROS.map((valor, indice) => (
                  <li key={valor}>
                    <a
                      href="#"
                      className={filtro === valor ? 'current' : undefined}
                      data-filter={valor}
                      onClick={(evento) => { evento.preventDefault(); aplicarFiltro(valor); }}
                    >
                      {ETIQUETAS[valor]}
                    </a>
                    {indice < FILTROS.length - 1 ? ' |' : ''}
                  </li>
                ))}
              </ul>
              <div className="tablenav-actions">
                <select
                  id="filter-category"
                  aria-label="Filtrar por categoría"
                  value={categoriaId}
                  onChange={(evento) => {
                    setCategoriaId(evento.target.value);
                    setPagina(1);
                  }}
                >
                  <option value="">Todas las categorías</option>
                  {categorias.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {`${categoria.nombre}${categoria.activa ? '' : ' (inactiva)'}`}
                    </option>
                  ))}
                </select>
                <div className="search-box">
                  <input
                    id="search"
                    type="search"
                    placeholder="Buscar por nombre, SKU o slug…"
                    value={busquedaInput}
                    onChange={(evento) => setBusquedaInput(evento.target.value)}
                  />
                  <button
                    id="btn-search"
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => {
                      setBusqueda(busquedaInput);
                      setPagina(1);
                    }}
                  >
                    Buscar
                  </button>
                </div>
              </div>
            </div>

            <div className="bulk-row">
              <select id="bulk-action" aria-label="Acciones en lote" value={accionBulk} onChange={(evento) => setAccionBulk(evento.target.value)}>
                <option value="">Acciones en lote</option>
                <option value="publicar">Publicar</option>
                <option value="borrador">Pasar a borrador</option>
                <option value="destacar">Marcar destacado</option>
                <option value="quitar-destacado">Quitar destacado</option>
                <option value="eliminar">Enviar a papelera</option>
                <option value="restaurar">Restaurar (publicar papelera)</option>
              </select>
              <button id="btn-bulk" className="btn btn-ghost" type="button" onClick={() => void aplicarBulk()}>
                Aplicar
              </button>
              <span id="count-label" className="count-label">{conteoSeleccion}</span>
            </div>

            <TablaProductos
              productos={productos}
              seleccion={seleccion}
              cargando={!datosListos}
              onCambiarSeleccion={cambiarSeleccion}
              onSeleccionarTodos={seleccionarTodos}
              onEditar={(id) => void editarProducto(id)}
              onVer={(id) => void verDetalle(id)}
              onPapelera={pedirEliminar}
              onRestaurar={(id) => void restaurar(id)}
            />

            <div className="tablenav bottom">
              <span id="pagination-info" className="muted">{`${paginacion.total} elemento(s)`}</span>
              <div className="pager">
                <button
                  id="prev-page"
                  className="btn btn-ghost"
                  type="button"
                  disabled={paginacion.page <= 1}
                  onClick={() => setPagina((p) => (p > 1 ? p - 1 : p))}
                >
                  ‹ Anterior
                </button>
                <span id="page-info">{`Página ${paginacion.page} de ${paginacion.totalPages}`}</span>
                <button
                  id="next-page"
                  className="btn btn-ghost"
                  type="button"
                  disabled={paginacion.page >= paginacion.totalPages}
                  onClick={() => setPagina((p) => (p + 1 <= paginacion.totalPages ? p + 1 : p))}
                >
                  Siguiente ›
                </button>
              </div>
            </div>
          </section>

          <p className="help-text">
            El borrado envía a papelera (despublica) y puede restaurarse. No existe borrado definitivo
            por HTTP: la purga se hace en base de datos con respaldo. Todo cambio de stock exige motivo
            y genera un movimiento de inventario.
          </p>

          <section
            ref={seccionActividadRef}
            className="wp-card activity-card"
            id="activity-section"
            hidden={!actividadVisible}
          >
            <div className="tablenav top">
              <h2>Actividad reciente <small className="muted">bitácora de administración</small></h2>
              <button id="btn-activity-refresh" className="btn btn-ghost" type="button" onClick={() => void cargarActividad()}>
                ⟳ Actualizar
              </button>
            </div>
            <div className="table-wrap">
              <table className="wp-table">
                <thead>
                  <tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Producto</th><th>Detalle</th></tr>
                </thead>
                <tbody id="activity-tbody">
                  {actividad === null ? (
                    <tr><td colSpan={5} className="empty">Sin registros.</td></tr>
                  ) : actividad.length === 0 ? (
                    <tr><td colSpan={5} className="empty">{avisoActividad || 'Sin registros todavía.'}</td></tr>
                  ) : (
                    actividad.map((registro) => (
                      <tr key={registro.id}>
                        <td>{fechaCorta(registro.createdAt)}</td>
                        <td>{registro.usuario_email || `#${registro.usuario_id ?? '—'}`}</td>
                        <td>{registro.accion}</td>
                        <td>{registro.entidad_id ? `#${registro.entidad_id}` : '—'}</td>
                        <td>{registro.detalle ? JSON.stringify(registro.detalle).slice(0, 160) : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {modo === 'producto' ? (
        <ModalProducto
          key={productoEditar?.id ?? 'nuevo'}
          producto={productoEditar}
          categorias={categorias}
          onCerrar={() => setModo('ninguno')}
          onGuardado={cargarTodo}
          toast={toast}
        />
      ) : null}

      {modo === 'detalle' && productoDetalle ? (
        <ModalDetalle
          producto={productoDetalle}
          onCerrar={() => setModo('ninguno')}
          onEditar={() => void editarDesdeDetalle()}
          onPapelera={papeleraDesdeDetalle}
        />
      ) : null}

      {modo === 'confirmar' && pendiente ? (
        <ModalConfirmacion
          titulo="Enviar a papelera"
          texto={`“${pendiente.nombre || 'este producto'}” se despublicará y podrá restaurarse. No hay borrado definitivo por HTTP.`}
          onCancelar={() => setModo('ninguno')}
          onConfirmar={() => void confirmarEliminar()}
        />
      ) : null}

      {modo === 'login' ? (
        <ModalLogin mensaje={mensajeLogin} onSesionIniciada={alIniciarSesion} />
      ) : null}

      <div id="toasts" className="toasts" aria-live="polite">
        {avisos.map((aviso) => (
          <div key={aviso.id} className={`toast${aviso.tipo ? ` ${aviso.tipo}` : ''}`}>{aviso.texto}</div>
        ))}
      </div>
    </>
  );
}

function obtenerToken(): string {
  return sessionStorage.getItem(TOKEN_KEY) || '';
}
