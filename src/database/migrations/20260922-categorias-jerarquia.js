'use strict';

/**
 * Documenta la ampliación de categorías que ya existe en la base de laboratorio.
 *
 * La migración es idempotente para poder aplicarse a una base nueva o a una base
 * que ya recibió el ALTER manualmente en phpMyAdmin. No inserta categorías ni
 * reasigna productos: esos datos pertenecen al catálogo y se administran aparte.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columnas = await queryInterface.describeTable('categorias');
    if (!columnas.parent_id) {
      await queryInterface.addColumn('categorias', 'parent_id', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      });
    }

    const indices = await queryInterface.showIndex('categorias');
    if (!indices.some((indice) => indice.name === 'idx_categorias_parent')) {
      await queryInterface.addIndex('categorias', ['parent_id'], { name: 'idx_categorias_parent' });
    }

    const claves = typeof queryInterface.getForeignKeyReferencesForTable === 'function'
      ? await queryInterface.getForeignKeyReferencesForTable('categorias')
      : [];
    const existeClave = claves.some((clave) => (
      clave.constraintName === 'fk_categorias_parent'
      || clave.constraint_name === 'fk_categorias_parent'
      || (clave.columnName === 'parent_id' && clave.referencedTableName === 'categorias')
      || (clave.COLUMN_NAME === 'parent_id' && clave.REFERENCED_TABLE_NAME === 'categorias')
    ));
    if (!existeClave) {
      await queryInterface.addConstraint('categorias', {
        fields: ['parent_id'],
        type: 'foreign key',
        name: 'fk_categorias_parent',
        references: { table: 'categorias', field: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      });
    }
  },

  async down(queryInterface) {
    const columnas = await queryInterface.describeTable('categorias');
    if (!columnas.parent_id) return;

    // La reversión es deliberadamente conservadora: no borra relaciones de datos.
    const [referencias] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) AS total FROM categorias WHERE parent_id IS NOT NULL',
    );
    if (Number(referencias[0]?.total || 0) > 0) {
      throw new Error('No se puede revertir la jerarquía mientras existan categorías hijas. Desasigna parent_id con una operación aprobada.');
    }

    const claves = typeof queryInterface.getForeignKeyReferencesForTable === 'function'
      ? await queryInterface.getForeignKeyReferencesForTable('categorias')
      : [];
    const clave = claves.find((item) => (
      item.constraintName === 'fk_categorias_parent'
      || item.constraint_name === 'fk_categorias_parent'
    ));
    if (clave) await queryInterface.removeConstraint('categorias', 'fk_categorias_parent');

    const indices = await queryInterface.showIndex('categorias');
    if (indices.some((indice) => indice.name === 'idx_categorias_parent')) {
      await queryInterface.removeIndex('categorias', 'idx_categorias_parent');
    }
    await queryInterface.removeColumn('categorias', 'parent_id');
  },
};
