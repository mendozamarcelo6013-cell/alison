'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('pedidos', 'tipo_comprobante', {
      type: Sequelize.ENUM('boleta', 'factura'),
      allowNull: false,
      defaultValue: 'boleta',
    });
    await queryInterface.addColumn('pedidos', 'ruc_factura', {
      type: Sequelize.STRING(11),
      allowNull: true,
    });
    await queryInterface.addColumn('pedidos', 'razon_social_factura', {
      type: Sequelize.STRING(180),
      allowNull: true,
    });
    await queryInterface.addColumn('pedidos', 'direccion_factura', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('pedidos', 'direccion_factura');
    await queryInterface.removeColumn('pedidos', 'razon_social_factura');
    await queryInterface.removeColumn('pedidos', 'ruc_factura');
    await queryInterface.removeColumn('pedidos', 'tipo_comprobante');
  },
};
