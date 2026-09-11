const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PedidoItem = sequelize.define('PedidoItem', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  pedido_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: 'pedidos', key: 'id' },
  },
  producto_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: 'productos', key: 'id' },
  },
  sku: { type: DataTypes.STRING(80), allowNull: false },
  nombre_producto: { type: DataTypes.STRING(180), allowNull: false },
  precio_unitario: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  tasa_igv: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
  cantidad: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  total_linea: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
}, {
  tableName: 'pedido_items',
  timestamps: true,
  underscored: false,
});

module.exports = PedidoItem;
