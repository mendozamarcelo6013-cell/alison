const { AuditoriaAdmin } = require('../models');

// La bitácora es obligatoria: si este insert falla, el error se propaga
// y la transacción que lo contiene hace rollback. No se captura aquí.
async function registrarAuditoria({ usuario, accion, entidad = 'producto', entidadId = null, detalle = null, ip = null }, transaction = null) {
  await AuditoriaAdmin.create({
    usuario_id: usuario?.id ?? null,
    usuario_email: usuario?.email ?? null,
    accion,
    entidad,
    entidad_id: entidadId,
    detalle,
    ip,
  }, transaction ? { transaction } : {});
}

module.exports = { registrarAuditoria };
