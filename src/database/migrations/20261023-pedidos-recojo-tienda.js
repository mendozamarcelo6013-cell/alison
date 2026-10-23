'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('pedidos', 'metodo_entrega', {
      type: Sequelize.ENUM('envio_domicilio', 'recojo_tienda'),
      allowNull: false,
      defaultValue: 'envio_domicilio',
    });
    await queryInterface.addColumn('pedidos', 'estado_recojo', {
      type: Sequelize.ENUM('pendiente', 'en_preparacion', 'listo_para_recoger', 'entregado'),
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('pedidos', 'estado_recojo');
    await queryInterface.removeColumn('pedidos', 'metodo_entrega');
  },
};
