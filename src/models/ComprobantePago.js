const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ComprobantePago = sequelize.define('ComprobantePago', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  pago_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: 'pagos', key: 'id' },
  },
  archivo_url: { type: DataTypes.STRING(500), allowNull: false },
  nombre_archivo: { type: DataTypes.STRING(255), allowNull: false },
  mime_type: { type: DataTypes.STRING(100), allowNull: false },
  tamanio_bytes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
}, {
  tableName: 'comprobantes_pago',
  timestamps: true,
  underscored: false,
});

module.exports = ComprobantePago;
