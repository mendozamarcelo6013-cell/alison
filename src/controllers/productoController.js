const { Categoria, Producto, ProductoImagen } = require('../models');
const { construirUrlPublica } = require('../services/imagenProducto');

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
  'controla_stock',
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
  order: [['principal', 'DESC'], ['orden', 'ASC'], ['id', 'ASC']],
};

exports.listarProductos = async (req, res) => {
  try {
    const productos = await Producto.findAll({
      where: { activo: true },
      attributes: atributosProducto,
      include: [incluirCategoria, incluirImagenes],
      order: [['destacado', 'DESC'], ['createdAt', 'DESC']],
    });

    const resultado = productos.map((producto) => {
      const datos = producto.toJSON();
      const imagenes = Array.isArray(datos.imagenes) ? datos.imagenes : [];
      const portada = imagenes.find((imagen) => imagen.principal) || imagenes[0];
      datos.imagenes = portada ? [portada] : [];
      datos.imagenes.forEach((imagen) => { imagen.url = construirUrlPublica(req, imagen.url); });
      return datos;
    });
    return res.json({ ok: true, productos: resultado });
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

    const datos = producto.toJSON();
    (datos.imagenes || []).forEach((imagen) => { imagen.url = construirUrlPublica(req, imagen.url); });
    return res.json({ ok: true, producto: datos });
  } catch (error) {
    console.error('Error al obtener producto:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'No se pudo obtener el producto',
    });
  }
};
