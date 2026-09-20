const sequelize = require('../config/database');
const { Producto, ProductoImagen } = require('../models');
const { registrarAuditoria } = require('../services/auditoria');
const { eliminarArchivoLocal, urlPublicaProducto } = require('../services/imagenProducto');

function ordenSolicitado(valor, fallback) {
  const orden = Number.parseInt(valor, 10);
  return Number.isInteger(orden) && orden >= 0 ? orden : fallback;
}

async function siguienteOrden(productoId, transaction) {
  const imagen = await ProductoImagen.findOne({
    where: { producto_id: productoId },
    order: [['orden', 'DESC'], ['id', 'DESC']],
    transaction,
  });
  return imagen ? Number(imagen.orden) + 1 : 0;
}

async function convertirEnPrincipal(imagen, transaction) {
  await ProductoImagen.update(
    { principal: false },
    { where: { producto_id: imagen.producto_id, principal: true }, transaction },
  );
  await ProductoImagen.update(
    { principal: true, orden: 0 },
    { where: { id: imagen.id, producto_id: imagen.producto_id }, transaction },
  );
}

exports.subirImagenesProducto = async (req, res) => {
  const archivos = Array.isArray(req.files) ? req.files : [];
  if (!archivos.length) return res.status(400).json({ ok: false, mensaje: 'Selecciona al menos una imagen.' });

  const t = await sequelize.transaction();
  try {
    const producto = await Producto.scope('todos').findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!producto) {
      await t.rollback();
      return res.status(404).json({ ok: false, mensaje: 'Producto no encontrado.' });
    }

    let orden = await siguienteOrden(producto.id, t);
    const indicePrincipal = Number.parseInt(req.body.principal_index, 10);
    const tienePrincipal = await ProductoImagen.count({ where: { producto_id: producto.id, principal: true }, transaction: t }) > 0;
    const creadas = [];

    for (const [indice, archivo] of archivos.entries()) {
      const imagen = await ProductoImagen.create({
        producto_id: producto.id,
        url: urlPublicaProducto(producto.id, archivo.filename),
        texto_alternativo: String(req.body.texto_alternativo || producto.nombre).slice(0, 255),
        orden,
        principal: Number.isInteger(indicePrincipal) ? indice === indicePrincipal : (!tienePrincipal && indice === 0),
      }, { transaction: t });
      creadas.push(imagen);
      orden += 1;
    }

    if (creadas.some((imagen) => imagen.principal)) {
      const portada = creadas.find((imagen) => imagen.principal);
      await convertirEnPrincipal(portada, t);
    }

    await registrarAuditoria({
      usuario: req.usuario, accion: 'producto.imagenes.subir', entidadId: producto.id,
      detalle: { cantidad: creadas.length }, ip: req.ip,
    }, t);
    await t.commit();
    return res.status(201).json({ ok: true, mensaje: `${creadas.length} imagen(es) subida(s).`, imagenes: creadas });
  } catch (error) {
    await t.rollback();
    archivos.forEach((archivo) => eliminarArchivoLocal(`/uploads/productos/${req.params.id}/${archivo.filename}`));
    console.error('Error al subir imágenes del producto:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudieron guardar las imágenes.' });
  }
};

exports.eliminarImagenProducto = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const imagen = await ProductoImagen.findOne({
      where: { id: req.params.imagenId, producto_id: req.params.id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!imagen) {
      await t.rollback();
      return res.status(404).json({ ok: false, mensaje: 'Imagen no encontrada.' });
    }
    const eraPrincipal = imagen.principal;
    const url = imagen.url;
    await imagen.destroy({ transaction: t });

    if (eraPrincipal) {
      const siguiente = await ProductoImagen.findOne({
        where: { producto_id: req.params.id },
        order: [['orden', 'ASC'], ['id', 'ASC']],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (siguiente) await convertirEnPrincipal(siguiente, t);
    }

    await registrarAuditoria({
      usuario: req.usuario, accion: 'producto.imagen.eliminar', entidadId: Number(req.params.id),
      detalle: { imagen_id: Number(req.params.imagenId) }, ip: req.ip,
    }, t);
    await t.commit();
    eliminarArchivoLocal(url);
    return res.json({ ok: true, mensaje: 'Imagen eliminada correctamente.' });
  } catch (error) {
    await t.rollback();
    console.error('Error al eliminar imagen:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo eliminar la imagen.' });
  }
};

exports.establecerImagenPrincipal = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const imagen = await ProductoImagen.findOne({
      where: { id: req.params.imagenId, producto_id: req.params.id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!imagen) {
      await t.rollback();
      return res.status(404).json({ ok: false, mensaje: 'Imagen no encontrada.' });
    }
    await convertirEnPrincipal(imagen, t);
    await registrarAuditoria({
      usuario: req.usuario, accion: 'producto.imagen.principal', entidadId: Number(req.params.id),
      detalle: { imagen_id: imagen.id }, ip: req.ip,
    }, t);
    await t.commit();
    return res.json({ ok: true, mensaje: 'Imagen principal actualizada.' });
  } catch (error) {
    await t.rollback();
    console.error('Error al establecer imagen principal:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo establecer la imagen principal.' });
  }
};