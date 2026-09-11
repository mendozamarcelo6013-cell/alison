const Usuario = require('./Usuario');
const Direccion = require('./Direccion');
const Categoria = require('./Categoria');
const Producto = require('./Producto');
const ProductoImagen = require('./ProductoImagen');
const Pedido = require('./Pedido');
const PedidoItem = require('./PedidoItem');
const Pago = require('./Pago');
const ComprobantePago = require('./ComprobantePago');
const Envio = require('./Envio');
const MovimientoStock = require('./MovimientoStock');

Usuario.hasMany(Direccion, { foreignKey: 'usuario_id', as: 'direcciones' });
Usuario.hasMany(Pedido, { foreignKey: 'usuario_id', as: 'pedidos' });
Usuario.hasMany(Pago, { foreignKey: 'revisado_por_usuario_id', as: 'pagosRevisados' });
Usuario.hasMany(MovimientoStock, { foreignKey: 'creado_por_usuario_id', as: 'movimientosCreados' });

Direccion.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario' });
Direccion.hasMany(Pedido, { foreignKey: 'direccion_id', as: 'pedidos' });

Categoria.hasMany(Producto, { foreignKey: 'categoria_id', as: 'productos' });

Producto.belongsTo(Categoria, { foreignKey: 'categoria_id', as: 'categoria' });
Producto.hasMany(ProductoImagen, { foreignKey: 'producto_id', as: 'imagenes' });
Producto.hasMany(PedidoItem, { foreignKey: 'producto_id', as: 'pedidoItems' });
Producto.hasMany(MovimientoStock, { foreignKey: 'producto_id', as: 'movimientosStock' });

ProductoImagen.belongsTo(Producto, { foreignKey: 'producto_id', as: 'producto' });

Pedido.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario' });
Pedido.belongsTo(Direccion, { foreignKey: 'direccion_id', as: 'direccion' });
Pedido.hasMany(PedidoItem, { foreignKey: 'pedido_id', as: 'items' });
Pedido.hasMany(Pago, { foreignKey: 'pedido_id', as: 'pagos' });
Pedido.hasMany(Envio, { foreignKey: 'pedido_id', as: 'envios' });
Pedido.hasMany(MovimientoStock, { foreignKey: 'pedido_id', as: 'movimientosStock' });

PedidoItem.belongsTo(Pedido, { foreignKey: 'pedido_id', as: 'pedido' });
PedidoItem.belongsTo(Producto, { foreignKey: 'producto_id', as: 'producto' });

Pago.belongsTo(Pedido, { foreignKey: 'pedido_id', as: 'pedido' });
Pago.belongsTo(Usuario, { foreignKey: 'revisado_por_usuario_id', as: 'revisor' });
Pago.hasMany(ComprobantePago, { foreignKey: 'pago_id', as: 'comprobantes' });

ComprobantePago.belongsTo(Pago, { foreignKey: 'pago_id', as: 'pago' });

Envio.belongsTo(Pedido, { foreignKey: 'pedido_id', as: 'pedido' });

MovimientoStock.belongsTo(Producto, { foreignKey: 'producto_id', as: 'producto' });
MovimientoStock.belongsTo(Pedido, { foreignKey: 'pedido_id', as: 'pedido' });
MovimientoStock.belongsTo(Usuario, { foreignKey: 'creado_por_usuario_id', as: 'creador' });

module.exports = {
  Usuario,
  Direccion,
  Categoria,
  Producto,
  ProductoImagen,
  Pedido,
  PedidoItem,
  Pago,
  ComprobantePago,
  Envio,
  MovimientoStock,
};
