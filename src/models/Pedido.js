const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pedido = sequelize.define('Pedido', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  numero_pedido: { type: DataTypes.STRING(40), allowNull: false, unique: true },
  usuario_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: 'usuarios', key: 'id' },
  },
  direccion_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: 'direcciones', key: 'id' },
  },
  email_cliente: { type: DataTypes.STRING(150), allowNull: false },
  destinatario: { type: DataTypes.STRING(160), allowNull: true },
  telefono_entrega: { type: DataTypes.STRING(30), allowNull: true },
  direccion_entrega: { type: DataTypes.JSON, allowNull: true },
  estado: {
    type: DataTypes.ENUM('pendiente_pago', 'pago_reportado', 'pagado', 'preparando', 'enviado', 'entregado', 'cancelado'),
    allowNull: false,
    defaultValue: 'pendiente_pago',
  },
  subtotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  igv_total: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  envio_total: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  descuento_total: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  moneda: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: 'PEN' },
  notas_cliente: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'pedidos',
  timestamps: true,
  underscored: false,
});

module.exports = Pedido;
