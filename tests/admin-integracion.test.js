/* Integración HTTP del panel admin contra la BD real de laboratorio.
 * Requiere MySQL alcanzable (mismas vars que server.js). Si no hay BD, se omite.
 * Crea un admin y un producto temporales y los purga al final; solo quedan las
 * filas de auditoría (comportamiento intencional de la bitácora).
 */
process.env.LOGIN_RATE_MAX = process.env.LOGIN_RATE_MAX || '6';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { exigirSecretoArranque } = require('../src/utils/token');

describe('arranque seguro', () => {
  it('exige ADMIN_SESSION_SECRET en producción', () => {
    const guardaEnv = process.env.NODE_ENV;
    const guardaSecreto = process.env.ADMIN_SESSION_SECRET;
    const guardaJwt = process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.JWT_SECRET;
    try {
      assert.throws(() => exigirSecretoArranque(), /ADMIN_SESSION_SECRET/);
    } finally {
      process.env.NODE_ENV = guardaEnv;
      if (guardaSecreto !== undefined) process.env.ADMIN_SESSION_SECRET = guardaSecreto;
      if (guardaJwt !== undefined) process.env.JWT_SECRET = guardaJwt;
    }
  });
});

describe('API admin (HTTP)', async () => {
  const app = require('../src/app');
  const sequelize = require('../src/config/database');

  let disponible = true;
  try {
    await sequelize.authenticate();
  } catch {
    disponible = false;
  }
  if (!disponible) {
    it('omite integración sin BD', (t) => t.skip('MySQL no alcanzable'));
    return;
  }

  const { firmarToken } = require('../src/utils/token');
  const { hashPassword } = require('../src/utils/password');
  const { Usuario, MovimientoStock, ProductoImagen, Producto } = require('../src/models');

  let server;
  let base;
  let admin;
  let tokenAdmin;
  let idProducto;

  const J = (o) => JSON.stringify(o);
  const H = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` });

  before(async () => {
    // La migración de auditoría debe estar aplicada.
    const [tablas] = await sequelize.query(
      "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'auditoria_admin'",
    );
    assert.equal(Number(tablas[0].n), 1, 'falta aplicar la migración 20260920-admin-auditoria');

    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;

    admin = await Usuario.create({
      nombres: 'Test', apellidos: 'Integracion',
      email: `test-int-${Date.now()}@horus.local`,
      password_hash: hashPassword('clave-temporal-123'),
      rol: 'admin', activo: true,
    });
    tokenAdmin = firmarToken({ sub: admin.id, email: admin.email, rol: 'admin' }, 600);
  });

  after(async () => {
    if (idProducto) {
      const t = await sequelize.transaction();
      try {
        await MovimientoStock.destroy({ where: { producto_id: idProducto }, transaction: t });
        await ProductoImagen.destroy({ where: { producto_id: idProducto }, transaction: t });
        await Producto.scope('todos').destroy({ where: { id: idProducto }, force: true, transaction: t });
        await t.commit();
      } catch {
        await t.rollback();
      }
    }
    if (admin) await Usuario.destroy({ where: { id: admin.id }, force: true }).catch(() => {});
    if (server) await new Promise((r) => server.close(r));
  });

  it('401 sin token en lectura, escritura y borrado duro', async () => {
    assert.equal((await fetch(`${base}/api/admin/productos`)).status, 401);
    const post = await fetch(`${base}/api/admin/productos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(post.status, 401);
    const del = await fetch(`${base}/api/admin/productos/1?hard=true`, { method: 'DELETE' });
    assert.equal(del.status, 401);
  });

  it('no acepta cookie admin_token (solo Bearer, sin superficie CSRF)', async () => {
    const r = await fetch(`${base}/api/admin/productos`, { headers: { Cookie: `admin_token=${tokenAdmin}` } });
    assert.equal(r.status, 401);
  });

  it('403 con rol cliente', async () => {
    const cliente = firmarToken({ sub: 0, email: 'c@c.c', rol: 'cliente' }, 300);
    const r = await fetch(`${base}/api/admin/productos`, { headers: { Authorization: `Bearer ${cliente}` } });
    assert.equal(r.status, 403);
  });

  it('login valida campos y credenciales', async () => {
    const login = (b) => fetch(`${base}/api/admin/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: J(b),
    });
    assert.equal((await login({ email: '' })).status, 400);
    assert.equal((await login({ email: 'nadie@horus.local', password: 'clave-larga-000' })).status, 401);
    const ok = await login({ email: admin.email, password: 'clave-temporal-123' });
    assert.equal(ok.status, 200);
    assert.ok((await ok.json()).token);
  });

  it('ciclo CRUD con auditoría y movimientos', async () => {
    // Crear con stock -> 201 + movimiento de ingreso.
    let r = await fetch(`${base}/api/admin/productos`, {
      method: 'POST', headers: H(),
      body: J({ nombre: 'Temporal Integración', precio: 19.9, stock: 5, motivo_stock: 'Alta inicial test', imagen_url: 'https://example.com/t.png' }),
    });
    assert.equal(r.status, 201);
    idProducto = (await r.json()).producto.id;
    assert.ok(idProducto);

    // Stock sin motivo -> 400 y el stock queda intacto (rollback).
    r = await fetch(`${base}/api/admin/productos/${idProducto}`, {
      method: 'PUT', headers: H(), body: J({ stock: 99 }),
    });
    assert.equal(r.status, 400);
    r = await fetch(`${base}/api/admin/productos/${idProducto}`, { headers: H() });
    assert.equal((await r.json()).producto.stock, 5);

    // Stock con motivo -> 200 + movimiento de ajuste.
    r = await fetch(`${base}/api/admin/productos/${idProducto}`, {
      method: 'PUT', headers: H(), body: J({ stock: 12, motivo_stock: 'Conteo fisico test' }),
    });
    assert.equal(r.status, 200);
    r = await fetch(`${base}/api/admin/productos/${idProducto}`, { headers: H() });
    const detalle = await r.json();
    const movs = detalle.producto.movimientosStock.map((m) => `${m.tipo}:${m.cantidad}->${m.stock_resultante}`);
    assert.ok(movs.includes('ingreso:5->5'), `movimientos: ${movs}`);
    assert.ok(movs.includes('ajuste:7->12'), `movimientos: ${movs}`);

    // Papelera -> despublica; restaurar -> publica.
    assert.equal((await fetch(`${base}/api/admin/productos/${idProducto}`, { method: 'DELETE', headers: H() })).status, 200);
    r = await fetch(`${base}/api/admin/productos/${idProducto}`, { headers: H() });
    assert.equal((await r.json()).producto.activo, false);
    assert.equal((await fetch(`${base}/api/admin/productos/${idProducto}/restaurar`, { method: 'POST', headers: H() })).status, 200);

    // Borrado duro eliminado de la API.
    r = await fetch(`${base}/api/admin/productos/${idProducto}?hard=true`, { method: 'DELETE', headers: H() });
    assert.equal(r.status, 410);

    // Bitácora con las 4 acciones.
    r = await fetch(`${base}/api/admin/auditoria?limit=50`, { headers: H() });
    const acciones = (await r.json()).registros.filter((x) => x.entidad_id === idProducto).map((x) => x.accion);
    for (const esperada of ['producto.crear', 'producto.actualizar', 'producto.papelera', 'producto.restaurar']) {
      assert.ok(acciones.includes(esperada), `falta ${esperada} en [${acciones}]`);
    }
  });

  it('paginación del backend', async () => {
    const r = await fetch(`${base}/api/admin/productos?page=1&limit=2`, { headers: H() });
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.ok(d.paginacion.total >= 1);
    assert.ok(d.productos.length <= 2);
    assert.ok(Array.isArray(d.productos[0].imagenes));
  });

  it('gestiona varias imágenes, portada y fallback al eliminarla', async () => {
    const archivos = [0, 1, 2, 3].map((indice) => new Blob([`imagen-${indice}`], { type: 'image/png' }));
    const formulario = new FormData();
    archivos.forEach((archivo, indice) => formulario.append('imagenes', archivo, `imagen-${indice}.png`));
    formulario.append('principal_index', '2');
    let r = await fetch(`${base}/api/admin/productos/${idProducto}/imagenes`, {
      method: 'POST', headers: { Authorization: `Bearer ${tokenAdmin}` }, body: formulario,
    });
    assert.equal(r.status, 201);
    let datos = await r.json();
    assert.equal(datos.imagenes.length, 4);
    assert.equal(datos.imagenes.filter((imagen) => imagen.principal).length, 1);

    r = await fetch(`${base}/api/admin/productos/${idProducto}`, { headers: H() });
    datos = await r.json();
    assert.equal(datos.producto.imagenes.length, 5);
    const portadaInicial = datos.producto.imagenes.find((imagen) => imagen.principal);
    assert.ok(portadaInicial, JSON.stringify(datos.producto.imagenes));
    const nuevaPortada = datos.producto.imagenes.find((imagen) => imagen.id !== portadaInicial.id);

    r = await fetch(`${base}/api/admin/productos/${idProducto}/imagenes/${nuevaPortada.id}/principal`, {
      method: 'PATCH', headers: H(),
    });
    assert.equal(r.status, 200);

    r = await fetch(`${base}/api/admin/productos/${idProducto}/imagenes/${nuevaPortada.id}`, {
      method: 'DELETE', headers: H(),
    });
    assert.equal(r.status, 200);

    r = await fetch(`${base}/api/admin/productos/${idProducto}`, { headers: H() });
    datos = await r.json();
    assert.equal(datos.producto.imagenes.length, 4);
    assert.equal(datos.producto.imagenes.filter((imagen) => imagen.principal).length, 1);

    r = await fetch(`${base}/api/productos/${encodeURIComponent(datos.producto.slug)}`);
    assert.equal(r.status, 200);
    const publico = await r.json();
    assert.equal(publico.producto.imagenes.length, 4);
    assert.equal(publico.producto.imagenes[0].principal, true);

    r = await fetch(`${base}/api/productos`);
    const listadoPublico = await r.json();
    const productoListado = listadoPublico.productos.find((producto) => producto.id === idProducto);
    assert.equal(productoListado.imagenes.length, 1);

    for (const imagen of datos.producto.imagenes) {
      r = await fetch(`${base}/api/admin/productos/${idProducto}/imagenes/${imagen.id}`, {
        method: 'DELETE', headers: H(),
      });
      assert.equal(r.status, 200);
    }
    r = await fetch(`${base}/api/productos/${encodeURIComponent(datos.producto.slug)}`);
    assert.deepEqual((await r.json()).producto.imagenes, []);

    const unaImagen = new FormData();
    unaImagen.append('imagenes', new Blob(['una-imagen'], { type: 'image/png' }), 'una-imagen.png');
    r = await fetch(`${base}/api/admin/productos/${idProducto}/imagenes`, {
      method: 'POST', headers: { Authorization: `Bearer ${tokenAdmin}` }, body: unaImagen,
    });
    assert.equal(r.status, 201);
    r = await fetch(`${base}/api/productos/${encodeURIComponent(datos.producto.slug)}`);
    assert.equal((await r.json()).producto.imagenes.length, 1);
  });

  it('rate-limit de login responde 429 tras la ráfaga (último)', async () => {
    const login = () => fetch(`${base}/api/admin/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: J({ email: 'nadie@horus.local', password: 'clave-larga-000' }),
    });
    let ultimo = 0;
    for (let i = 0; i < 8; i++) ultimo = (await login()).status;
    assert.equal(ultimo, 429);
  });
});
