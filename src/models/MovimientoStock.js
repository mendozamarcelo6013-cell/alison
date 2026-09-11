const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MovimientoStock = sequelize.define('MovimientoStock', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  producto_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: 'productos', key: 'id' },
  },
  pedido_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: 'pedidos', key: 'id' },
  },
  tipo: {
    type: DataTypes.ENUM('ingreso', 'reserva', 'liberacion', 'venta', 'ajuste', 'devolucion'),
    allowNull: false,
  },
  cantidad: { type: DataTypes.INTEGER, allowNull: false },
  stock_resultante: { type: DataTypes.INTEGER, allowNull: false },
  nota: { type: DataTypes.STRING(500), allowNull: true },
  creado_por_usuario_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: 'usuarios', key: 'id' },
  },
}, {
  tableName: 'movimientos_stock',
  timestamps: true,
  underscored: false,
});

module.exports = MovimientoStock;
