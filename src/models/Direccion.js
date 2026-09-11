const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Direccion = sequelize.define('Direccion', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  usuario_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: 'usuarios', key: 'id' },
  },
  destinatario: { type: DataTypes.STRING(160), allowNull: false },
  telefono: { type: DataTypes.STRING(30), allowNull: false },
  departamento: { type: DataTypes.STRING(100), allowNull: false },
  provincia: { type: DataTypes.STRING(100), allowNull: false },
  distrito: { type: DataTypes.STRING(100), allowNull: false },
  direccion_linea1: { type: DataTypes.STRING(255), allowNull: false },
  referencia: { type: DataTypes.STRING(255), allowNull: true },
  codigo_postal: { type: DataTypes.STRING(15), allowNull: true },
  predeterminada: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'direcciones',
  timestamps: true,
  underscored: false,
});

module.exports = Direccion;
