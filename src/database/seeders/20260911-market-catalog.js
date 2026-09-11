'use strict';

const now = new Date();

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('categorias', [
      { id: 1, nombre: 'Videovigilancia', slug: 'videovigilancia', descripcion: 'Cámaras y accesorios de seguridad.', activa: true, orden: 1, createdAt: now, updatedAt: now },
      { id: 2, nombre: 'Redes y cableado', slug: 'redes-y-cableado', descripcion: 'Equipos y accesorios para conectividad.', activa: true, orden: 2, createdAt: now, updatedAt: now },
      { id: 3, nombre: 'Soporte tecnológico', slug: 'soporte-tecnologico', descripcion: 'Servicios de soporte y mantenimiento.', activa: true, orden: 3, createdAt: now, updatedAt: now },
    ]);

    await queryInterface.bulkInsert('productos', [
      {
        categoria_id: 1, nombre: 'Cámara IP interior 2 MP', slug: 'camara-ip-interior-2mp', sku: 'HG-CAM-2MP-INT',
        descripcion_corta: 'Cámara de seguridad para interiores con resolución Full HD.', tipo: 'fisico', precio: 129.90,
        tasa_igv: 18.00, moneda: 'PEN', stock: 12, controla_stock: true, peso_gramos: 350, activo: true, destacado: true, createdAt: now, updatedAt: now,
      },
      {
        categoria_id: 2, nombre: 'Cable UTP Cat 6 por metro', slug: 'cable-utp-cat-6-por-metro', sku: 'HG-UTP-CAT6-M',
        descripcion_corta: 'Cable de red Cat 6 para instalaciones de alto rendimiento.', tipo: 'fisico', precio: 3.50,
        tasa_igv: 18.00, moneda: 'PEN', stock: 500, controla_stock: true, peso_gramos: 40, activo: true, destacado: true, createdAt: now, updatedAt: now,
      },
      {
        categoria_id: 3, nombre: 'Diagnóstico técnico remoto', slug: 'diagnostico-tecnico-remoto', sku: 'HG-SRV-DIAG-REM',
        descripcion_corta: 'Evaluación inicial remota para incidencias tecnológicas.', tipo: 'servicio', precio: 45.00,
        tasa_igv: 18.00, moneda: 'PEN', stock: 0, controla_stock: false, peso_gramos: null, activo: true, destacado: false, createdAt: now, updatedAt: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('productos', { sku: ['HG-CAM-2MP-INT', 'HG-UTP-CAT6-M', 'HG-SRV-DIAG-REM'] });
    await queryInterface.bulkDelete('categorias', { slug: ['videovigilancia', 'redes-y-cableado', 'soporte-tecnologico'] });
  },
};
