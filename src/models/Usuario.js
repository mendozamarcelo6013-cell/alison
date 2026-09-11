const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Usuario = sequelize.define('Usuario', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  nombres: { type: DataTypes.STRING(100), allowNull: false },
  apellidos: { type: DataTypes.STRING(100), allowNull: false },
  email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  telefono: { type: DataTypes.STRING(30), allowNull: true },
  documento_tipo: { type: DataTypes.STRING(20), allowNull: true },
  documento_numero: { type: DataTypes.STRING(30), allowNull: true },
  rol: { type: DataTypes.ENUM('cliente', 'admin'), allowNull: false, defaultValue: 'cliente' },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  acepta_terminos_en: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'usuarios',
  timestamps: true,
  underscored: false,
});

module.exports = Usuario;
