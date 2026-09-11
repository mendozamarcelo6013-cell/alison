const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Categoria = sequelize.define('Categoria', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: { notEmpty: true },
  },
  slug: {
    type: DataTypes.STRING(120),
    allowNull: false,
    unique: true,
    validate: { notEmpty: true },
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  imagen_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  activa: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  orden: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'categorias',
  timestamps: true,
  underscored: false,
  defaultScope: {
    order: [['orden', 'ASC'], ['nombre', 'ASC']],
  },
});

module.exports = Categoria;
