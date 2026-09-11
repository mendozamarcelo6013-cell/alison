'use strict';

const timestamps = (Sequelize) => ({
  createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    const id = { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true };
    const foreignId = (tableName, allowNull = false, onDelete = 'RESTRICT') => ({
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull,
      references: { model: tableName, key: 'id' },
      onUpdate: 'CASCADE',
      onDelete,
    });

    await queryInterface.createTable('usuarios', {
      id,
      nombres: { type: Sequelize.STRING(100), allowNull: false },
      apellidos: { type: Sequelize.STRING(100), allowNull: false },
      email: { type: Sequelize.STRING(150), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      telefono: { type: Sequelize.STRING(30), allowNull: true },
      documento_tipo: { type: Sequelize.STRING(20), allowNull: true },
      documento_numero: { type: Sequelize.STRING(30), allowNull: true },
      rol: { type: Sequelize.ENUM('cliente', 'admin'), allowNull: false, defaultValue: 'cliente' },
      activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      acepta_terminos_en: { type: Sequelize.DATE, allowNull: true },
      ...timestamps(Sequelize),
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await queryInterface.createTable('direcciones', {
      id,
      usuario_id: foreignId('usuarios', false, 'CASCADE'),
      destinatario: { type: Sequelize.STRING(160), allowNull: false },
      telefono: { type: Sequelize.STRING(30), allowNull: false },
      departamento: { type: Sequelize.STRING(100), allowNull: false },
      provincia: { type: Sequelize.STRING(100), allowNull: false },
      distrito: { type: Sequelize.STRING(100), allowNull: false },
      direccion_linea1: { type: Sequelize.STRING(255), allowNull: false },
      referencia: { type: Sequelize.STRING(255), allowNull: true },
      codigo_postal: { type: Sequelize.STRING(15), allowNull: true },
      predeterminada: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      ...timestamps(Sequelize),
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await queryInterface.createTable('categorias', {
      id,
      nombre: { type: Sequelize.STRING(100), allowNull: false },
      slug: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      descripcion: { type: Sequelize.TEXT, allowNull: true },
      imagen_url: { type: Sequelize.STRING(500), allowNull: true },
      activa: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      orden: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      ...timestamps(Sequelize),
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await queryInterface.createTable('productos', {
      id,
      categoria_id: foreignId('categorias', true, 'SET NULL'),
      nombre: { type: Sequelize.STRING(180), allowNull: false },
      slug: { type: Sequelize.STRING(200), allowNull: false, unique: true },
      sku: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      descripcion_corta: { type: Sequelize.STRING(500), allowNull: true },
      descripcion: { type: Sequelize.TEXT, allowNull: true },
      tipo: { type: Sequelize.ENUM('fisico', 'servicio', 'digital'), allowNull: false, defaultValue: 'fisico' },
      precio: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      tasa_igv: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 18.00 },
      moneda: { type: Sequelize.CHAR(3), allowNull: false, defaultValue: 'PEN' },
      stock: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      controla_stock: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      peso_gramos: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
      activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      destacado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      ...timestamps(Sequelize),
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await queryInterface.createTable('producto_imagenes', {
      id,
      producto_id: foreignId('productos', false, 'CASCADE'),
      url: { type: Sequelize.STRING(500), allowNull: false },
      texto_alternativo: { type: Sequelize.STRING(255), allowNull: true },
      orden: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      principal: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      ...timestamps(Sequelize),
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await queryInterface.createTable('pedidos', {
      id,
      numero_pedido: { type: Sequelize.STRING(40), allowNull: false, unique: true },
      // Se permite comprar como invitado; la cuenta queda asociada cuando existe.
      usuario_id: foreignId('usuarios', true, 'SET NULL'),
      direccion_id: foreignId('direcciones', true, 'SET NULL'),
      email_cliente: { type: Sequelize.STRING(150), allowNull: false },
      destinatario: { type: Sequelize.STRING(160), allowNull: true },
      telefono_entrega: { type: Sequelize.STRING(30), allowNull: true },
      direccion_entrega: { type: Sequelize.JSON, allowNull: true },
      estado: { type: Sequelize.ENUM('pendiente_pago', 'pago_reportado', 'pagado', 'preparando', 'enviado', 'entregado', 'cancelado'), allowNull: false, defaultValue: 'pendiente_pago' },
      subtotal: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      igv_total: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      envio_total: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      descuento_total: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      total: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      moneda: { type: Sequelize.CHAR(3), allowNull: false, defaultValue: 'PEN' },
      notas_cliente: { type: Sequelize.TEXT, allowNull: true },
      ...timestamps(Sequelize),
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await queryInterface.createTable('pedido_items', {
      id,
      pedido_id: foreignId('pedidos', false, 'CASCADE'),
      producto_id: foreignId('productos', true, 'SET NULL'),
      sku: { type: Sequelize.STRING(80), allowNull: false },
      nombre_producto: { type: Sequelize.STRING(180), allowNull: false },
      precio_unitario: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      tasa_igv: { type: Sequelize.DECIMAL(5, 2), allowNull: false },
      cantidad: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      total_linea: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      ...timestamps(Sequelize),
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await queryInterface.createTable('pagos', {
      id,
      pedido_id: foreignId('pedidos', false, 'RESTRICT'),
      metodo: { type: Sequelize.ENUM('yape', 'plin', 'transferencia', 'deposito', 'pasarela'), allowNull: false },
      estado: { type: Sequelize.ENUM('pendiente', 'en_revision', 'aprobado', 'rechazado', 'anulado'), allowNull: false, defaultValue: 'pendiente' },
      monto: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      moneda: { type: Sequelize.CHAR(3), allowNull: false, defaultValue: 'PEN' },
      codigo_operacion: { type: Sequelize.STRING(100), allowNull: true },
      pagado_en: { type: Sequelize.DATE, allowNull: true },
      revisado_en: { type: Sequelize.DATE, allowNull: true },
      revisado_por_usuario_id: foreignId('usuarios', true, 'SET NULL'),
      observacion: { type: Sequelize.STRING(500), allowNull: true },
      ...timestamps(Sequelize),
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await queryInterface.createTable('comprobantes_pago', {
      id,
      pago_id: foreignId('pagos', false, 'CASCADE'),
      archivo_url: { type: Sequelize.STRING(500), allowNull: false },
      nombre_archivo: { type: Sequelize.STRING(255), allowNull: false },
      mime_type: { type: Sequelize.STRING(100), allowNull: false },
      tamanio_bytes: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      ...timestamps(Sequelize),
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await queryInterface.createTable('envios', {
      id,
      pedido_id: foreignId('pedidos', false, 'RESTRICT'),
      estado: { type: Sequelize.ENUM('pendiente', 'despachado', 'entregado', 'devuelto'), allowNull: false, defaultValue: 'pendiente' },
      transportista: { type: Sequelize.STRING(120), allowNull: true },
      numero_guia: { type: Sequelize.STRING(100), allowNull: true },
      costo: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      despachado_en: { type: Sequelize.DATE, allowNull: true },
      entregado_en: { type: Sequelize.DATE, allowNull: true },
      observacion: { type: Sequelize.TEXT, allowNull: true },
      ...timestamps(Sequelize),
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await queryInterface.createTable('movimientos_stock', {
      id,
      producto_id: foreignId('productos', false, 'RESTRICT'),
      pedido_id: foreignId('pedidos', true, 'SET NULL'),
      tipo: { type: Sequelize.ENUM('ingreso', 'reserva', 'liberacion', 'venta', 'ajuste', 'devolucion'), allowNull: false },
      cantidad: { type: Sequelize.INTEGER, allowNull: false },
      stock_resultante: { type: Sequelize.INTEGER, allowNull: false },
      nota: { type: Sequelize.STRING(500), allowNull: true },
      creado_por_usuario_id: foreignId('usuarios', true, 'SET NULL'),
      ...timestamps(Sequelize),
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await queryInterface.addIndex('direcciones', ['usuario_id', 'predeterminada']);
    await queryInterface.addIndex('productos', ['categoria_id', 'activo']);
    await queryInterface.addIndex('productos', ['activo', 'destacado']);
    await queryInterface.addIndex('producto_imagenes', ['producto_id', 'orden']);
    await queryInterface.addIndex('pedidos', ['usuario_id', 'estado']);
    await queryInterface.addIndex('pedidos', ['estado', 'createdAt']);
    await queryInterface.addIndex('pedido_items', ['pedido_id']);
    await queryInterface.addIndex('pagos', ['pedido_id', 'estado']);
    await queryInterface.addIndex('envios', ['pedido_id', 'estado']);
    await queryInterface.addIndex('movimientos_stock', ['producto_id', 'createdAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('movimientos_stock');
    await queryInterface.dropTable('envios');
    await queryInterface.dropTable('comprobantes_pago');
    await queryInterface.dropTable('pagos');
    await queryInterface.dropTable('pedido_items');
    await queryInterface.dropTable('pedidos');
    await queryInterface.dropTable('producto_imagenes');
    await queryInterface.dropTable('productos');
    await queryInterface.dropTable('categorias');
    await queryInterface.dropTable('direcciones');
    await queryInterface.dropTable('usuarios');
  },
};
