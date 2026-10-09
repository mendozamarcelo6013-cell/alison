const { Categoria } = require('../models');
const { categoriasPublicas } = require('../services/categoriaJerarquia');

exports.listarCategorias = async (req, res) => {
  try {
    const categorias = await Categoria.findAll({
      attributes: ['id', 'nombre', 'slug', 'descripcion', 'imagen_url', 'activa', 'orden', 'parent_id'],
      order: [['orden', 'ASC'], ['nombre', 'ASC']],
    });

    const visibles = categoriasPublicas(categorias.map((categoria) => categoria.toJSON()))
      .map(({ activa, orden, ...categoria }) => ({ ...categoria, parent_id: categoria.parent_id ?? null }));
    return res.json({ ok: true, categorias: visibles });
  } catch (error) {
    console.error('Error al listar categorías:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'No se pudieron obtener las categorías',
    });
  }
};
