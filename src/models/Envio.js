const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Envio = sequelize.define('Envio', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  pedido_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: 'pedidos', key: 'id' },
  },
  estado: {
    type: DataTypes.ENUM('pendiente', 'despachado', 'entregado', 'devuelto'),
    allowNull: false,
    defaultValue: 'pendiente',
  },
  transportista: { type: DataTypes.STRING(120), allowNull: true },
  numero_guia: { type: DataTypes.STRING(100), allowNull: true },
  costo: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  despachado_en: { type: DataTypes.DATE, allowNull: true },
  entregado_en: { type: DataTypes.DATE, allowNull: true },
  observacion: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'envios',
  timestamps: true,
  underscored: false,
});

module.exports = Envio;
