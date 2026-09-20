const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Bitácora de acciones del panel admin: quién hizo qué, sobre qué producto y desde qué IP.
const AuditoriaAdmin = sequelize.define('AuditoriaAdmin', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  usuario_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  usuario_email: { type: DataTypes.STRING(150), allowNull: true },
  accion: { type: DataTypes.STRING(60), allowNull: false },
  entidad: { type: DataTypes.STRING(60), allowNull: false, defaultValue: 'producto' },
  entidad_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  detalle: { type: DataTypes.JSON, allowNull: true },
  ip: { type: DataTypes.STRING(60), allowNull: true },
}, {
  tableName: 'auditoria_admin',
  timestamps: true,
  updatedAt: false,
});

module.exports = AuditoriaAdmin;
