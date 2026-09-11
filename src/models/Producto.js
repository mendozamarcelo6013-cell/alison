const { DataTypes, Op } = require('sequelize');
const sequelize = require('../config/database');

const Producto = sequelize.define('Producto', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  categoria_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: 'categorias', key: 'id' },
  },
  nombre: {
    type: DataTypes.STRING(180),
    allowNull: false,
    validate: { notEmpty: true },
  },
  slug: {
    type: DataTypes.STRING(200),
    allowNull: false,
    unique: true,
    validate: { notEmpty: true },
  },
  sku: {
    type: DataTypes.STRING(80),
    allowNull: false,
    unique: true,
    validate: { notEmpty: true },
  },
  descripcion_corta: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  tipo: {
    type: DataTypes.ENUM('fisico', 'servicio', 'digital'),
    allowNull: false,
    defaultValue: 'fisico',
  },
  precio: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: { min: 0 },
  },
  tasa_igv: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 18.00,
    validate: { min: 0, max: 100 },
  },
  moneda: {
    type: DataTypes.CHAR(3),
    allowNull: false,
    defaultValue: 'PEN',
  },
  stock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0 },
  },
  controla_stock: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  peso_gramos: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  destacado: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  tableName: 'productos',
  timestamps: true,
  underscored: false,
  defaultScope: {
    where: { activo: true },
    order: [['destacado', 'DESC'], ['createdAt', 'DESC']],
  },
  scopes: {
    todos: { where: {} },
    destacados: { where: { activo: true, destacado: true } },
    disponibles: {
      where: {
        activo: true,
        [Op.or]: [
          { controla_stock: false },
          { controla_stock: true, stock: { [Op.gt]: 0 } },
        ],
      },
    },
  },
});

module.exports = Producto;
