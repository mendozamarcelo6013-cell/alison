const { Categoria } = require('../models');

exports.listarCategorias = async (req, res) => {
  try {
    const categorias = await Categoria.findAll({
      where: { activa: true },
      attributes: ['id', 'nombre', 'slug', 'descripcion', 'imagen_url'],
      order: [['orden', 'ASC'], ['nombre', 'ASC']],
    });

    return res.json({ ok: true, categorias });
  } catch (error) {
    console.error('Error al listar categorías:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'No se pudieron obtener las categorías',
    });
  }
};
