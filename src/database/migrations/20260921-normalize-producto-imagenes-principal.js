'use strict';

module.exports = {
  async up(queryInterface) {
    const [filas] = await queryInterface.sequelize.query(
      'SELECT producto_id, id FROM producto_imagenes WHERE principal = 1 ORDER BY producto_id ASC, orden ASC, id ASC',
    );
    const conservadas = new Set();
    for (const fila of filas) {
      if (!conservadas.has(fila.producto_id)) {
        conservadas.add(fila.producto_id);
        continue;
      }
      await queryInterface.sequelize.query(
        'UPDATE producto_imagenes SET principal = 0 WHERE id = :id',
        { replacements: { id: fila.id } },
      );
    }
  },

  async down() {
    // La normalizacion no puede revertirse sin conocer el estado anterior.
  },
};
