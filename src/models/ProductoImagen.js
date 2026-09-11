const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductoImagen = sequelize.define('ProductoImagen', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  producto_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: 'productos', key: 'id' },
  },
  url: { type: DataTypes.STRING(500), allowNull: false },
  texto_alternativo: { type: DataTypes.STRING(255), allowNull: true },
  orden: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  principal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'producto_imagenes',
  timestamps: true,
  underscored: false,
});

module.exports = ProductoImagen;
