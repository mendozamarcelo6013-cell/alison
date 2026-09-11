const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pago = sequelize.define('Pago', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  pedido_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: 'pedidos', key: 'id' },
  },
  metodo: {
    type: DataTypes.ENUM('yape', 'plin', 'transferencia', 'deposito', 'pasarela'),
    allowNull: false,
  },
  estado: {
    type: DataTypes.ENUM('pendiente', 'en_revision', 'aprobado', 'rechazado', 'anulado'),
    allowNull: false,
    defaultValue: 'pendiente',
  },
  monto: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  moneda: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: 'PEN' },
  codigo_operacion: { type: DataTypes.STRING(100), allowNull: true },
  pagado_en: { type: DataTypes.DATE, allowNull: true },
  revisado_en: { type: DataTypes.DATE, allowNull: true },
  revisado_por_usuario_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: 'usuarios', key: 'id' },
  },
  observacion: { type: DataTypes.STRING(500), allowNull: true },
}, {
  tableName: 'pagos',
  timestamps: true,
  underscored: false,
});

module.exports = Pago;
