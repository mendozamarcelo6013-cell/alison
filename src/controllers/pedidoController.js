const crypto = require('crypto');
const sequelize = require('../config/database');
const {
  Producto,
  Pedido,
  PedidoItem,
  MovimientoStock,
} = require('../models');

class ErrorPedido extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

function textoRequerido(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function consolidarItems(items) {
  if (!Array.isArray(items)) {
    throw new ErrorPedido(400, 'Los items deben ser un arreglo');
  }
  if (items.length === 0) {
    throw new ErrorPedido(400, 'El carrito está vacío');
  }

  const consolidados = new Map();
  items.forEach((item) => {
    const slug = textoRequerido(item?.slug);
    const cantidad = item?.cantidad;

    if (!slug || !Number.isInteger(cantidad) || cantidad <= 0) {
      throw new ErrorPedido(400, 'Cada producto debe tener un slug y una cantidad entera mayor a cero');
    }

    const acumulada = (consolidados.get(slug) || 0) + cantidad;
    if (!Number.isSafeInteger(acumulada)) {
      throw new ErrorPedido(400, 'La cantidad solicitada no es válida');
    }
    consolidados.set(slug, acumulada);
  });

  return [...consolidados.entries()].map(([slug, cantidad]) => ({ slug, cantidad }));
}

function convertirACentavos(valor) {
  const numero = Number(valor);
  const centavos = Math.round(numero * 100);
  if (!Number.isFinite(numero) || numero < 0 || !Number.isSafeInteger(centavos)) {
    throw new ErrorPedido(500, 'El precio de un producto no es válido');
  }
  return centavos;
}

function monedaDesdeCentavos(centavos) {
  return (centavos / 100).toFixed(2);
}

function calcularIgvIncluido(totalLineaCentavos, tasaIgv) {
  const tasa = Number(tasaIgv);
  if (!Number.isFinite(tasa) || tasa < 0) {
    throw new ErrorPedido(500, 'La tasa de IGV de un producto no es válida');
  }
  return Math.round((totalLineaCentavos * tasa) / (100 + tasa));
}

function generarNumeroPedido() {
  const fecha = new Date();
  const dia = [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, '0'),
    String(fecha.getDate()).padStart(2, '0'),
  ].join('');
  const aleatorio = crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
  return `HG-${dia}-${aleatorio}`;
}

function esColisionNumeroPedido(error) {
  return error?.name === 'SequelizeUniqueConstraintError'
    && error.errors?.some((detalle) => detalle.path === 'numero_pedido');
}

function crearDireccionEntrega(direccion) {
  if (!direccion || typeof direccion !== 'object' || Array.isArray(direccion)) {
    return null;
  }

  return {
    departamento: textoRequerido(direccion.departamento),
    provincia: textoRequerido(direccion.provincia),
    distrito: textoRequerido(direccion.distrito),
    direccion_linea1: textoRequerido(direccion.direccion_linea1),
    referencia: textoRequerido(direccion.referencia) || null,
  };
}

function validarDireccionFisica(direccion) {
  return direccion
    && direccion.departamento
    && direccion.provincia
    && direccion.distrito
    && direccion.direccion_linea1;
}

async function crearPedidoEnTransaccion(datos, numeroPedido) {
  return sequelize.transaction(async (transaction) => {
    const productosPedido = [];
    let contieneProductoFisico = false;

    for (const item of datos.items) {
      const producto = await Producto.unscoped().findOne({
        where: { slug: item.slug },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!producto || !producto.activo) {
        throw new ErrorPedido(404, 'Uno de los productos ya no está disponible');
      }
      if (!['fisico', 'servicio', 'digital'].includes(producto.tipo)) {
        throw new ErrorPedido(400, `El tipo del producto ${producto.nombre} no es válido`);
      }
      if (producto.controla_stock && item.cantidad > producto.stock) {
        throw new ErrorPedido(409, `Stock insuficiente para ${producto.nombre}`);
      }

      contieneProductoFisico ||= producto.tipo === 'fisico';
      productosPedido.push({ producto, cantidad: item.cantidad });
    }

    if (contieneProductoFisico && !validarDireccionFisica(datos.direccionEntrega)) {
      throw new ErrorPedido(400, 'La dirección de entrega es obligatoria para productos físicos');
    }

    let subtotalCentavos = 0;
    let igvTotalCentavos = 0;
    const itemsHistoricos = productosPedido.map(({ producto, cantidad }) => {
      const precioUnitarioCentavos = convertirACentavos(producto.precio);
      const totalLineaCentavos = precioUnitarioCentavos * cantidad;
      if (!Number.isSafeInteger(totalLineaCentavos)) {
        throw new ErrorPedido(400, 'El importe del pedido excede el límite permitido');
      }

      subtotalCentavos += totalLineaCentavos;
      igvTotalCentavos += calcularIgvIncluido(totalLineaCentavos, producto.tasa_igv);

      return {
        producto_id: producto.id,
        sku: producto.sku,
        nombre_producto: producto.nombre,
        precio_unitario: monedaDesdeCentavos(precioUnitarioCentavos),
        tasa_igv: producto.tasa_igv,
        cantidad,
        total_linea: monedaDesdeCentavos(totalLineaCentavos),
      };
    });

    if (!Number.isSafeInteger(subtotalCentavos) || !Number.isSafeInteger(igvTotalCentavos)) {
      throw new ErrorPedido(400, 'El importe del pedido excede el límite permitido');
    }

    const subtotal = monedaDesdeCentavos(subtotalCentavos);
    const igvTotal = monedaDesdeCentavos(igvTotalCentavos);
    const envioTotal = '0.00';
    const descuentoTotal = '0.00';
    const total = subtotal;

    const pedido = await Pedido.create({
      numero_pedido: numeroPedido,
      usuario_id: null,
      direccion_id: null,
      email_cliente: datos.email,
      destinatario: datos.destinatario,
      telefono_entrega: datos.telefono,
      direccion_entrega: datos.direccionEntrega,
      notas_cliente: datos.notas,
      estado: 'pendiente_pago',
      subtotal,
      igv_total: igvTotal,
      envio_total: envioTotal,
      descuento_total: descuentoTotal,
      total,
      moneda: 'PEN',
    }, { transaction });

    await PedidoItem.bulkCreate(
      itemsHistoricos.map((item) => ({ ...item, pedido_id: pedido.id })),
      { transaction },
    );

    for (const { producto, cantidad } of productosPedido) {
      if (!producto.controla_stock) continue;

      const stockResultante = producto.stock - cantidad;
      await producto.update({ stock: stockResultante }, { transaction });
      await MovimientoStock.create({
        producto_id: producto.id,
        pedido_id: pedido.id,
        tipo: 'reserva',
        cantidad: -cantidad,
        stock_resultante: stockResultante,
        nota: `Reserva por pedido ${numeroPedido}`,
        creado_por_usuario_id: null,
      }, { transaction });
    }

    return {
      numero_pedido: pedido.numero_pedido,
      estado: pedido.estado,
      subtotal,
      igv_total: igvTotal,
      envio_total: envioTotal,
      total,
      moneda: 'PEN',
    };
  });
}

exports.crearPedido = async (req, res) => {
  const body = req.body || {};
  const email = textoRequerido(body.email);
  const destinatario = textoRequerido(body.destinatario);
  const telefono = textoRequerido(body.telefono);
  const notas = textoRequerido(body.notas) || null;

  try {
    if (!email || !validarEmail(email)) {
      throw new ErrorPedido(400, 'El email es obligatorio y debe tener un formato válido');
    }
    if (!destinatario) {
      throw new ErrorPedido(400, 'El destinatario es obligatorio');
    }
    if (!telefono) {
      throw new ErrorPedido(400, 'El teléfono es obligatorio');
    }

    const datos = {
      email,
      destinatario,
      telefono,
      direccionEntrega: crearDireccionEntrega(body.direccion),
      notas,
      items: consolidarItems(body.items),
    };

    for (let intento = 0; intento < 3; intento += 1) {
      try {
        const pedido = await crearPedidoEnTransaccion(datos, generarNumeroPedido());
        return res.status(201).json({ ok: true, pedido });
      } catch (error) {
        if (esColisionNumeroPedido(error) && intento < 2) continue;
        throw error;
      }
    }
  } catch (error) {
    if (error instanceof ErrorPedido) {
      return res.status(error.status).json({ ok: false, mensaje: error.message });
    }

    console.error('Error al crear pedido:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo crear el pedido' });
  }

  return res.status(500).json({ ok: false, mensaje: 'No se pudo crear el pedido' });
};
