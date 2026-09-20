'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('auditoria_admin', {
      id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      usuario_id: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: true,
        references: { model: 'usuarios', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      usuario_email: { type: Sequelize.STRING(150), allowNull: true },
      accion: { type: Sequelize.STRING(60), allowNull: false },
      entidad: { type: Sequelize.STRING(60), allowNull: false, defaultValue: 'producto' },
      entidad_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
      detalle: { type: Sequelize.JSON, allowNull: true },
      ip: { type: Sequelize.STRING(60), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });
    await queryInterface.addIndex('auditoria_admin', ['entidad', 'entidad_id']);
    await queryInterface.addIndex('auditoria_admin', ['createdAt']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('auditoria_admin');
  },
};
