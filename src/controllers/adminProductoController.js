const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Categoria, Producto, ProductoImagen, MovimientoStock, AuditoriaAdmin } = require('../models');
const { registrarAuditoria } = require('../services/auditoria');

const atributosAdmin = [
  'id', 'categoria_id', 'nombre', 'slug', 'sku', 'descripcion_corta', 'descripcion',
  'tipo', 'precio', 'tasa_igv', 'moneda', 'stock', 'controla_stock', 'peso_gramos',
  'activo', 'destacado', 'createdAt', 'updatedAt',
];

const incluirCategoriaAdmin = {
  model: Categoria, as: 'categoria', required: false,
  attributes: ['id', 'nombre', 'slug'],
};

const incluirImagenesAdmin = {
  model: ProductoImagen, as: 'imagenes', required: false, separate: true,
  attributes: ['id', 'url', 'texto_alternativo', 'orden', 'principal'],
  order: [['orden', 'ASC']],
};

const incluirMovimientos = {
  model: MovimientoStock, as: 'movimientosStock', required: false, separate: true,
  attributes: ['id', 'tipo', 'cantidad', 'stock_resultante', 'nota', 'createdAt'],
  order: [['createdAt', 'DESC']],
  limit: 10,
};

function slugify(texto, fallback = 'producto') {
  const base = String(texto || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 190);
  return base || `${fallback}-${Date.now().toString(36)}`;
}

async function slugUnico(slugBase, excluirId = null, transaction = null) {
  let slug = slugBase;
  let intento = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existente = await Producto.scope('todos').findOne({ where: { slug }, transaction });
    if (!existente || (excluirId && existente.id === Number(excluirId))) return slug;
    intento += 1;
    slug = `${slugBase}-${intento}`;
  }
}

function skuAutomatico(nombre) {
  const prefijo = String(nombre || 'PRD').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 6).padEnd(3, 'X');
  return `${prefijo}-${Date.now().toString(36).toUpperCase()}`;
}

function normalizarDatos(body = {}) {
  const datos = {};
  if (body.nombre !== undefined) datos.nombre = String(body.nombre).trim();
  if (body.slug !== undefined) datos.slug = String(body.slug).trim();
  if (body.sku !== undefined) datos.sku = String(body.sku).trim();
  if (body.descripcion_corta !== undefined) datos.descripcion_corta = body.descripcion_corta ? String(body.descripcion_corta).trim().slice(0, 500) : null;
  if (body.descripcion !== undefined) datos.descripcion = body.descripcion ? String(body.descripcion) : null;
  if (body.tipo !== undefined) datos.tipo = body.tipo;
  if (body.precio !== undefined) datos.precio = Number(body.precio);
  if (body.tasa_igv !== undefined) datos.tasa_igv = Number(body.tasa_igv);
  if (body.moneda !== undefined) datos.moneda = String(body.moneda).toUpperCase().slice(0, 3);
  if (body.stock !== undefined) datos.stock = Number.parseInt(body.stock, 10);
  if (body.controla_stock !== undefined) datos.controla_stock = body.controla_stock === true || body.controla_stock === 'true' || body.controla_stock === 1;
  if (body.peso_gramos !== undefined) datos.peso_gramos = body.peso_gramos === '' || body.peso_gramos === null ? null : Number(body.peso_gramos);
  if (body.activo !== undefined) datos.activo = body.activo === true || body.activo === 'true' || body.activo === 1;
  if (body.destacado !== undefined) datos.destacado = body.destacado === true || body.destacado === 'true' || body.destacado === 1;
  if (body.categoria_id !== undefined) {
    datos.categoria_id = body.categoria_id === '' || body.categoria_id === null ? null : Number(body.categoria_id);
  }
  return datos;
}

function validar(datos, esCreacion = true) {
  const errores = [];
  if (esCreacion && !datos.nombre) errores.push('El nombre es obligatorio.');
  if (datos.nombre !== undefined && !datos.nombre) errores.push('El nombre no puede estar vacío.');
  if (datos.precio !== undefined && (!Number.isFinite(datos.precio) || datos.precio < 0)) {
    errores.push('El precio debe ser un número mayor o igual a 0.');
  }
  if (esCreacion && (datos.precio === undefined || !Number.isFinite(datos.precio))) {
    errores.push('El precio es obligatorio.');
  }
  if (datos.tipo !== undefined && !['fisico', 'servicio', 'digital'].includes(datos.tipo)) {
    errores.push('El tipo debe ser fisico, servicio o digital.');
  }
  if (datos.stock !== undefined && (!Number.isInteger(datos.stock) || datos.stock < 0)) {
    errores.push('El stock debe ser un entero mayor o igual a 0.');
  }
  if (datos.moneda !== undefined && !/^[A-Z]{3}$/.test(datos.moneda)) {
    errores.push('La moneda debe tener 3 letras (ej. PEN).');
  }
  return errores;
}

function motivoDe(body) {
  const m = body?.motivo_stock;
  if (m === undefined || m === null) return null;
  const s = String(m).trim().slice(0, 500);
  return s || null;
}

async function sincronizarImagenPrincipal(productoId, imagenUrl, textoAlternativo, transaction = null) {
  if (imagenUrl === undefined) return;
  const url = String(imagenUrl || '').trim().slice(0, 500);
  const existente = await ProductoImagen.findOne({ where: { producto_id: productoId, principal: true }, transaction });
  if (!url) {
    if (existente) await existente.destroy({ transaction });
    return;
  }
  if (existente) {
    await existente.update({ url, texto_alternativo: (textoAlternativo || null) }, { transaction });
  } else {
    await ProductoImagen.create({
      producto_id: productoId, url, texto_alternativo: textoAlternativo || null, orden: 0, principal: true,
    }, { transaction });
  }
}

function construirWhere(query = {}) {
  const where = {};
  if (query.estado === 'publicado') where.activo = true;
  if (query.estado === 'borrador') where.activo = false;
  if (query.destacado === 'true') where.destacado = true;
  if (query.sinStock === 'true') {
    where.controla_stock = true;
    where.stock = 0;
  }
  if (query.categoria_id) where.categoria_id = Number(query.categoria_id);
  if (query.search) {
    const like = `%${String(query.search).trim().slice(0, 80)}%`;
    where[Op.or] = [
      { nombre: { [Op.like]: like } },
      { slug: { [Op.like]: like } },
      { sku: { [Op.like]: like } },
    ];
  }
  return where;
}

// GET /api/admin/productos?page&limit&estado&categoria_id&search&sinStock&destacado
exports.listarTodos = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const where = construirWhere(req.query);
    const { count, rows } = await Producto.scope('todos').findAndCountAll({
      where,
      attributes: atributosAdmin,
      include: [incluirCategoriaAdmin],
      order: [['updatedAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    // Solo imagen principal en el listado (una consulta extra, sin N+1 ni over-fetch).
    const ids = rows.map((p) => p.id);
    let porProducto = {};
    if (ids.length) {
      const imgs = await ProductoImagen.findAll({
        where: { producto_id: ids },
        attributes: ['producto_id', 'id', 'url', 'texto_alternativo', 'orden', 'principal'],
        order: [['principal', 'DESC'], ['orden', 'ASC'], ['id', 'ASC']],
      });
      porProducto = Object.fromEntries(ids.map((id) => [id, []]));
      imgs.forEach((img) => {
        const lista = porProducto[img.producto_id];
        if (lista && !lista.length) lista.push(img);
      });
    }
    const productos = rows.map((p) => ({ ...p.toJSON(), imagenes: porProducto[p.id] || [] }));
    return res.json({
      ok: true,
      productos,
      paginacion: { total: count, page, limit, totalPages: Math.max(1, Math.ceil(count / limit)) },
    });
  } catch (error) {
    console.error('Error admin al listar productos:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudieron obtener los productos' });
  }
};

// GET /api/admin/productos/:id
exports.obtenerPorId = async (req, res) => {
  try {
    const producto = await Producto.scope('todos').findByPk(req.params.id, {
      attributes: atributosAdmin,
      include: [incluirCategoriaAdmin, incluirImagenesAdmin, incluirMovimientos],
    });
    if (!producto) return res.status(404).json({ ok: false, mensaje: 'Producto no encontrado' });
    return res.json({ ok: true, producto });
  } catch (error) {
    console.error('Error admin al obtener producto:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo obtener el producto' });
  }
};

// POST /api/admin/productos
exports.crear = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const datos = normalizarDatos(req.body);
    const motivo = motivoDe(req.body);
    if (!datos.slug && datos.nombre) datos.slug = slugify(datos.nombre);
    if (datos.slug) datos.slug = slugify(datos.slug);
    if (!datos.sku && datos.nombre) datos.sku = skuAutomatico(datos.nombre);
    if (datos.activo === undefined) datos.activo = true;
    if (datos.tipo === undefined) datos.tipo = 'fisico';
    if (datos.moneda === undefined) datos.moneda = 'PEN';
    if (datos.stock === undefined) datos.stock = 0;

    const errores = validar(datos, true);
    if (errores.length) { await t.rollback(); return res.status(400).json({ ok: false, mensaje: errores.join(' ') }); }

    datos.slug = await slugUnico(datos.slug, null, t);

    if (datos.categoria_id) {
      const categoria = await Categoria.findByPk(datos.categoria_id, { transaction: t });
      if (!categoria) { await t.rollback(); return res.status(400).json({ ok: false, mensaje: 'La categoría seleccionada no existe.' }); }
    }

    const producto = await Producto.scope('todos').create(datos, { transaction: t });
    await sincronizarImagenPrincipal(producto.id, req.body.imagen_url, req.body.imagen_texto || producto.nombre, t);

    if (producto.controla_stock && Number(producto.stock) > 0) {
      await MovimientoStock.create({
        producto_id: producto.id, tipo: 'ingreso', cantidad: Number(producto.stock),
        stock_resultante: Number(producto.stock),
        nota: motivo || 'Stock inicial desde panel admin',
        creado_por_usuario_id: req.usuario?.id ?? null,
      }, { transaction: t });
    }
    await registrarAuditoria({
      usuario: req.usuario, accion: 'producto.crear', entidadId: producto.id,
      detalle: { nombre: producto.nombre, sku: producto.sku, stock: producto.stock, precio: Number(producto.precio), motivo },
      ip: req.ip,
    }, t);

    await t.commit();
    const creado = await Producto.scope('todos').findByPk(producto.id, {
      attributes: atributosAdmin, include: [incluirCategoriaAdmin, incluirImagenesAdmin],
    });
    return res.status(201).json({ ok: true, mensaje: 'Producto creado correctamente.', producto: creado });
  } catch (error) {
    await t.rollback();
    console.error('Error admin al crear producto:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ ok: false, mensaje: 'El slug o SKU ya está en uso.' });
    }
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ ok: false, mensaje: error.errors.map((e) => e.message).join(' ') });
    }
    return res.status(500).json({ ok: false, mensaje: 'No se pudo crear el producto' });
  }
};

// PUT /api/admin/productos/:id
exports.actualizar = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const producto = await Producto.scope('todos').findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!producto) { await t.rollback(); return res.status(404).json({ ok: false, mensaje: 'Producto no encontrado' }); }

    const datos = normalizarDatos(req.body);
    const motivo = motivoDe(req.body);
    if (datos.slug !== undefined) datos.slug = slugify(datos.slug || producto.slug);
    if (datos.slug) datos.slug = await slugUnico(datos.slug, producto.id, t);

    const errores = validar(datos, false);
    if (errores.length) { await t.rollback(); return res.status(400).json({ ok: false, mensaje: errores.join(' ') }); }

    if (datos.categoria_id) {
      const categoria = await Categoria.findByPk(datos.categoria_id, { transaction: t });
      if (!categoria) { await t.rollback(); return res.status(400).json({ ok: false, mensaje: 'La categoría seleccionada no existe.' }); }
    }

    const stockAntes = Number(producto.stock);
    const stockDespues = datos.stock !== undefined ? datos.stock : stockAntes;
    if (datos.stock !== undefined && datos.stock !== stockAntes && !motivo) {
      await t.rollback();
      return res.status(400).json({ ok: false, mensaje: 'Indica el motivo del ajuste de stock (motivo_stock). Queda registrado en bitácora y movimientos.' });
    }

    const cambios = {};
    for (const [k, v] of Object.entries(datos)) {
      if (String(producto[k] ?? '') !== String(v ?? '')) cambios[k] = { antes: producto[k] ?? null, despues: v ?? null };
    }

    await producto.update(datos, { transaction: t });
    await sincronizarImagenPrincipal(producto.id, req.body.imagen_url,
      req.body.imagen_texto !== undefined ? req.body.imagen_texto : producto.nombre, t);

    if (datos.stock !== undefined && stockDespues !== stockAntes) {
      const delta = stockDespues - stockAntes;
      await MovimientoStock.create({
        producto_id: producto.id, tipo: 'ajuste', cantidad: delta, stock_resultante: stockDespues,
        nota: motivo || `Ajuste desde panel admin (${stockAntes} → ${stockDespues})`,
        creado_por_usuario_id: req.usuario?.id ?? null,
      }, { transaction: t });
    }
    await registrarAuditoria({
      usuario: req.usuario, accion: 'producto.actualizar', entidadId: producto.id,
      detalle: { cambios, motivo },
      ip: req.ip,
    }, t);

    await t.commit();
    const actualizado = await Producto.scope('todos').findByPk(producto.id, {
      attributes: atributosAdmin, include: [incluirCategoriaAdmin, incluirImagenesAdmin],
    });
    return res.json({ ok: true, mensaje: 'Producto actualizado correctamente.', producto: actualizado });
  } catch (error) {
    await t.rollback();
    console.error('Error admin al actualizar producto:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ ok: false, mensaje: 'El slug o SKU ya está en uso.' });
    }
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ ok: false, mensaje: error.errors.map((e) => e.message).join(' ') });
    }
    return res.status(500).json({ ok: false, mensaje: 'No se pudo actualizar el producto' });
  }
};

// DELETE /api/admin/productos/:id — solo papelera. El borrado duro se eliminó de la API pública.
exports.eliminar = async (req, res) => {
  if (req.query.hard === 'true') {
    return res.status(410).json({
      ok: false,
      mensaje: 'El borrado definitivo se eliminó de la API. El producto no fue modificado; usa la papelera o purga desde base de datos con respaldo.',
    });
  }
  const t = await sequelize.transaction();
  try {
    const producto = await Producto.scope('todos').findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!producto) { await t.rollback(); return res.status(404).json({ ok: false, mensaje: 'Producto no encontrado' }); }
    await producto.update({ activo: false }, { transaction: t });
    await registrarAuditoria({
      usuario: req.usuario, accion: 'producto.papelera', entidadId: producto.id,
      detalle: { nombre: producto.nombre, motivo: motivoDe(req.body) },
      ip: req.ip,
    }, t);
    await t.commit();
    return res.json({ ok: true, mensaje: 'Producto enviado a la papelera (despublicado). Puede restaurarse.' });
  } catch (error) {
    await t.rollback();
    console.error('Error admin al eliminar producto:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo eliminar el producto' });
  }
};

// POST /api/admin/productos/:id/restaurar
exports.restaurar = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const producto = await Producto.scope('todos').findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!producto) { await t.rollback(); return res.status(404).json({ ok: false, mensaje: 'Producto no encontrado' }); }
    await producto.update({ activo: true }, { transaction: t });
    await registrarAuditoria({
      usuario: req.usuario, accion: 'producto.restaurar', entidadId: producto.id,
      detalle: { nombre: producto.nombre }, ip: req.ip,
    }, t);
    await t.commit();
    return res.json({ ok: true, mensaje: 'Producto restaurado (publicado).' });
  } catch (error) {
    await t.rollback();
    console.error('Error admin al restaurar producto:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo restaurar el producto' });
  }
};

// GET /api/admin/categorias
exports.listarCategoriasTodas = async (req, res) => {
  try {
    const categorias = await Categoria.findAll({
      attributes: ['id', 'nombre', 'slug', 'activa'],
      order: [['orden', 'ASC'], ['nombre', 'ASC']],
    });
    return res.json({ ok: true, categorias });
  } catch (error) {
    console.error('Error admin al listar categorías:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudieron obtener las categorías' });
  }
};

// GET /api/admin/stats
exports.estadisticas = async (req, res) => {
  try {
    const [total, publicados, borradores, sinStock, destacados] = await Promise.all([
      Producto.scope('todos').count(),
      Producto.scope('todos').count({ where: { activo: true } }),
      Producto.scope('todos').count({ where: { activo: false } }),
      Producto.scope('todos').count({ where: { activo: true, controla_stock: true, stock: 0 } }),
      Producto.scope('todos').count({ where: { activo: true, destacado: true } }),
    ]);
    return res.json({ ok: true, stats: { total, publicados, borradores, sinStock, destacados } });
  } catch (error) {
    console.error('Error admin al obtener estadísticas:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudieron obtener las estadísticas' });
  }
};

// GET /api/admin/auditoria?page&limit
exports.listarAuditoria = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const { count, rows } = await AuditoriaAdmin.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    return res.json({
      ok: true,
      registros: rows,
      paginacion: { total: count, page, limit, totalPages: Math.max(1, Math.ceil(count / limit)) },
    });
  } catch (error) {
    // Si la migración aún no se aplicó, no romper el panel: responder vacío con aviso.
    if (error.name === 'SequelizeDatabaseError') {
      return res.json({ ok: true, registros: [], paginacion: { total: 0, page: 1, limit: 20, totalPages: 1 }, aviso: 'Aplica la migración 20260920-admin-auditoria.' });
    }
    console.error('Error admin al listar auditoría:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo obtener la bitácora' });
  }
};

module.exports._privado = { slugify, validar, construirWhere, normalizarDatos };
