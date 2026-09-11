const { Categoria, Producto, ProductoImagen } = require('../models');

const atributosProducto = [
  'id',
  'nombre',
  'slug',
  'descripcion_corta',
  'descripcion',
  'tipo',
  'precio',
  'moneda',
  'stock',
  'destacado',
];

const atributosProductoDetalle = [...atributosProducto, 'sku'];

const incluirCategoria = {
  model: Categoria,
  as: 'categoria',
  required: false,
  where: { activa: true },
  attributes: ['id', 'nombre', 'slug'],
};

const incluirImagenes = {
  model: ProductoImagen,
  as: 'imagenes',
  required: false,
  separate: true,
  attributes: ['id', 'url', 'texto_alternativo', 'orden', 'principal'],
  order: [['orden', 'ASC']],
};

exports.listarProductos = async (req, res) => {
  try {
    const productos = await Producto.findAll({
      where: { activo: true },
      attributes: atributosProducto,
      include: [incluirCategoria, incluirImagenes],
      order: [['destacado', 'DESC'], ['createdAt', 'DESC']],
    });

    return res.json({ ok: true, productos });
  } catch (error) {
    console.error('Error al listar productos:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'No se pudieron obtener los productos',
    });
  }
};

exports.obtenerProductoPorSlug = async (req, res) => {
  try {
    const producto = await Producto.findOne({
      where: {
        slug: req.params.slug,
        activo: true,
      },
      attributes: atributosProductoDetalle,
      include: [incluirCategoria, incluirImagenes],
    });

    if (!producto) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Producto no encontrado',
      });
    }

    return res.json({ ok: true, producto });
  } catch (error) {
    console.error('Error al obtener producto:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'No se pudo obtener el producto',
    });
  }
};
