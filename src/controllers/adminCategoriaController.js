'use strict';

const sequelize = require('../config/database');
const { Categoria, Producto } = require('../models');
const { registrarAuditoria } = require('../services/auditoria');
const { validarPadre, ordenarCategorias } = require('../services/categoriaJerarquia');

const ATRIBUTOS_CATEGORIA = [
  'id', 'nombre', 'slug', 'descripcion', 'imagen_url', 'activa', 'orden', 'parent_id', 'createdAt', 'updatedAt',
];

function slugificar(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 120);
}

function booleano(valor, porDefecto) {
  if (valor === undefined) return porDefecto;
  return valor === true || valor === 'true' || valor === 1;
}

function normalizar(body = {}, esCreacion = false) {
  const datos = {};
  if (body.nombre !== undefined) datos.nombre = String(body.nombre).trim().slice(0, 100);
  if (body.slug !== undefined) datos.slug = slugificar(body.slug);
  else if (esCreacion && body.nombre !== undefined) datos.slug = slugificar(body.nombre);
  if (body.descripcion !== undefined) datos.descripcion = body.descripcion === null ? null : String(body.descripcion).trim();
  if (body.imagen_url !== undefined) datos.imagen_url = body.imagen_url === null ? null : String(body.imagen_url).trim().slice(0, 500);
  if (body.orden !== undefined) datos.orden = Number.parseInt(body.orden, 10);
  if (body.parent_id !== undefined) datos.parent_id = body.parent_id === '' || body.parent_id === null ? null : Number(body.parent_id);
  if (body.activa !== undefined) datos.activa = booleano(body.activa, true);
  return datos;
}

function validar(datos, esCreacion = false) {
  const errores = [];
  if (esCreacion && !datos.nombre) errores.push('El nombre es obligatorio.');
  if (datos.nombre !== undefined && !datos.nombre) errores.push('El nombre no puede estar vacío.');
  if (esCreacion && !datos.slug) errores.push('El slug es obligatorio o debe poder generarse desde el nombre.');
  if (datos.slug !== undefined && (!datos.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(datos.slug))) {
    errores.push('El slug sólo puede contener letras minúsculas, números y guiones.');
  }
  if (datos.orden !== undefined && (!Number.isInteger(datos.orden) || datos.orden < 0)) {
    errores.push('El orden debe ser un entero mayor o igual a 0.');
  }
  if (datos.parent_id !== undefined && datos.parent_id !== null && (!Number.isInteger(datos.parent_id) || datos.parent_id < 1)) {
    errores.push('La categoría padre no es válida.');
  }
  return errores;
}

async function slugDisponible(slug, excluirId, transaction) {
  const existente = await Categoria.findOne({ where: { slug }, transaction });
  return !existente || Number(existente.id) === Number(excluirId);
}

async function validarDesactivacion(id, transaction) {
  const hijosActivos = await Categoria.count({ where: { parent_id: id, activa: true }, transaction });
  const productosActivos = await Producto.scope('todos').count({ where: { categoria_id: id, activo: true }, transaction });
  if (hijosActivos > 0) throw new Error('No se puede desactivar una categoría con subcategorías activas.');
  if (productosActivos > 0) throw new Error('No se puede desactivar una categoría con productos activos. Reasígnalos primero.');
}

exports.listar = async (req, res) => {
  try {
    const categorias = await Categoria.findAll({ attributes: ATRIBUTOS_CATEGORIA });
    return res.json({ ok: true, categorias: categorias.map((categoria) => categoria.toJSON()).sort(ordenarCategorias) });
  } catch (error) {
    console.error('Error admin al listar categorías:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudieron obtener las categorías' });
  }
};

exports.crear = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const datos = normalizar(req.body, true);
    const errores = validar(datos, true);
    if (errores.length) {
      await transaction.rollback();
      return res.status(400).json({ ok: false, mensaje: errores.join(' ') });
    }
    if (!(await slugDisponible(datos.slug, null, transaction))) {
      await transaction.rollback();
      return res.status(409).json({ ok: false, mensaje: 'El slug ya está en uso.' });
    }
    datos.parent_id = await validarPadre(Categoria, datos.parent_id, null, { transaction });
    const categoria = await Categoria.create(datos, { transaction });
    await registrarAuditoria({
      usuario: req.usuario, accion: 'categoria.crear', entidad: 'categoria', entidadId: categoria.id,
      detalle: { nombre: categoria.nombre, slug: categoria.slug, parent_id: categoria.parent_id }, ip: req.ip,
    }, transaction);
    await transaction.commit();
    return res.status(201).json({ ok: true, mensaje: 'Categoría creada correctamente.', categoria });
  } catch (error) {
    await transaction.rollback();
    if (/categoría padre|propio padre|ciclo|inconsistente/.test(error.message)) return res.status(400).json({ ok: false, mensaje: error.message });
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ ok: false, mensaje: 'El slug ya está en uso.' });
    console.error('Error admin al crear categoría:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo crear la categoría' });
  }
};

exports.actualizar = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const categoria = await Categoria.findByPk(req.params.id, { transaction });
    if (!categoria) {
      await transaction.rollback();
      return res.status(404).json({ ok: false, mensaje: 'Categoría no encontrada.' });
    }
    const datos = normalizar(req.body);
    const errores = validar(datos);
    if (errores.length) {
      await transaction.rollback();
      return res.status(400).json({ ok: false, mensaje: errores.join(' ') });
    }
    if (datos.slug !== undefined && !(await slugDisponible(datos.slug, categoria.id, transaction))) {
      await transaction.rollback();
      return res.status(409).json({ ok: false, mensaje: 'El slug ya está en uso.' });
    }
    if (datos.parent_id !== undefined) datos.parent_id = await validarPadre(Categoria, datos.parent_id, categoria.id, { transaction });
    if (datos.activa === false && categoria.activa !== false) await validarDesactivacion(categoria.id, transaction);
    await categoria.update(datos, { transaction });
    await registrarAuditoria({
      usuario: req.usuario, accion: 'categoria.actualizar', entidad: 'categoria', entidadId: categoria.id,
      detalle: { cambios: datos }, ip: req.ip,
    }, transaction);
    await transaction.commit();
    return res.json({ ok: true, mensaje: 'Categoría actualizada correctamente.', categoria });
  } catch (error) {
    await transaction.rollback();
    if (/categoría padre|propio padre|ciclo|inconsistente|desactivar/.test(error.message)) return res.status(400).json({ ok: false, mensaje: error.message });
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ ok: false, mensaje: 'El slug ya está en uso.' });
    console.error('Error admin al actualizar categoría:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo actualizar la categoría' });
  }
};

exports.desactivar = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const categoria = await Categoria.findByPk(req.params.id, { transaction });
    if (!categoria) {
      await transaction.rollback();
      return res.status(404).json({ ok: false, mensaje: 'Categoría no encontrada.' });
    }
    if (!categoria.activa) {
      await transaction.rollback();
      return res.status(400).json({ ok: false, mensaje: 'La categoría ya está inactiva.' });
    }
    await validarDesactivacion(categoria.id, transaction);
    await categoria.update({ activa: false }, { transaction });
    await registrarAuditoria({
      usuario: req.usuario, accion: 'categoria.desactivar', entidad: 'categoria', entidadId: categoria.id,
      detalle: { nombre: categoria.nombre }, ip: req.ip,
    }, transaction);
    await transaction.commit();
    return res.json({ ok: true, mensaje: 'Categoría desactivada correctamente.' });
  } catch (error) {
    await transaction.rollback();
    if (/desactivar/.test(error.message)) return res.status(409).json({ ok: false, mensaje: error.message });
    console.error('Error admin al desactivar categoría:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo desactivar la categoría' });
  }
};

exports.activar = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const categoria = await Categoria.findByPk(req.params.id, { transaction });
    if (!categoria) {
      await transaction.rollback();
      return res.status(404).json({ ok: false, mensaje: 'Categoría no encontrada.' });
    }
    if (categoria.parent_id !== null) await validarPadre(Categoria, categoria.parent_id, categoria.id, { transaction });
    await categoria.update({ activa: true }, { transaction });
    await registrarAuditoria({
      usuario: req.usuario, accion: 'categoria.activar', entidad: 'categoria', entidadId: categoria.id,
      detalle: { nombre: categoria.nombre }, ip: req.ip,
    }, transaction);
    await transaction.commit();
    return res.json({ ok: true, mensaje: 'Categoría activada correctamente.' });
  } catch (error) {
    await transaction.rollback();
    if (/categoría padre|propio padre|ciclo|inconsistente/.test(error.message)) return res.status(400).json({ ok: false, mensaje: error.message });
    console.error('Error admin al activar categoría:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo activar la categoría' });
  }
};

module.exports._privado = { slugificar, normalizar, validar, validarDesactivacion };
