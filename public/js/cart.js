(() => {
  const CART_KEY = 'horus_market_cart';

  function textoSeguro(valor) {
    return typeof valor === 'string' ? valor.trim() : '';
  }

  function cantidadValida(valor, alternativa = 1) {
    const cantidad = Number.parseInt(valor, 10);
    return Number.isInteger(cantidad) && cantidad > 0 ? cantidad : alternativa;
  }

  function normalizarCarrito(valor) {
    if (!Array.isArray(valor)) return [];

    const porSlug = new Map();
    valor.forEach((item) => {
      const productoId = Number.parseInt(item?.producto_id, 10);
      const slug = textoSeguro(item?.slug);
      if (!Number.isInteger(productoId) || productoId < 1 || !slug) return;

      const existente = porSlug.get(slug);
      const cantidad = cantidadValida(item?.cantidad);
      porSlug.set(slug, {
        producto_id: productoId,
        slug,
        cantidad: existente ? existente.cantidad + cantidad : cantidad,
      });
    });

    return [...porSlug.values()];
  }

  function obtenerCarrito() {
    try {
      return normalizarCarrito(JSON.parse(localStorage.getItem(CART_KEY) || '[]'));
    } catch {
      return [];
    }
  }

  function actualizarIndicadores() {
    const total = obtenerCarrito().reduce((acumulado, item) => acumulado + item.cantidad, 0);
    document.querySelectorAll('[data-cart-count]').forEach((elemento) => {
      elemento.textContent = String(total);
    });
  }

  function guardarCarrito(items) {
    const carrito = normalizarCarrito(items);
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(carrito));
    } catch (error) {
      console.error('No se pudo guardar el carrito local:', error);
    }
    actualizarIndicadores();
    return carrito;
  }

  function limiteStock(stock) {
    const cantidad = Number.parseInt(stock, 10);
    return Number.isInteger(cantidad) && cantidad >= 0 ? cantidad : null;
  }

  function agregarProducto({ producto_id, slug, cantidad = 1, stock }) {
    const productoId = Number.parseInt(producto_id, 10);
    const slugSeguro = textoSeguro(slug);
    const maximo = limiteStock(stock);

    if (!Number.isInteger(productoId) || productoId < 1 || !slugSeguro || maximo === null) {
      throw new Error('No se pudo validar el producto para agregarlo al carrito.');
    }
    if (maximo === 0) {
      throw new Error('El producto está agotado.');
    }

    const carrito = obtenerCarrito();
    const indice = carrito.findIndex((item) => item.slug === slugSeguro);
    const solicitada = cantidadValida(cantidad);

    if (indice === -1) {
      carrito.push({
        producto_id: productoId,
        slug: slugSeguro,
        cantidad: Math.min(solicitada, maximo),
      });
    } else {
      carrito[indice].cantidad = Math.min(carrito[indice].cantidad + solicitada, maximo);
    }

    return guardarCarrito(carrito).find((item) => item.slug === slugSeguro);
  }

  function actualizarCantidad(slug, cantidad, stock) {
    const slugSeguro = textoSeguro(slug);
    const maximo = limiteStock(stock);
    const carrito = obtenerCarrito();
    const indice = carrito.findIndex((item) => item.slug === slugSeguro);
    if (indice === -1 || maximo === null || maximo === 0) return carrito[indice] || null;

    carrito[indice].cantidad = Math.min(Math.max(cantidadValida(cantidad), 1), maximo);
    return guardarCarrito(carrito).find((item) => item.slug === slugSeguro);
  }

  function eliminarProducto(slug) {
    const slugSeguro = textoSeguro(slug);
    return guardarCarrito(obtenerCarrito().filter((item) => item.slug !== slugSeguro));
  }

  window.HorusCart = {
    key: CART_KEY,
    obtenerCarrito,
    guardarCarrito,
    agregarProducto,
    actualizarCantidad,
    eliminarProducto,
    contarUnidades: () => obtenerCarrito().reduce((acumulado, item) => acumulado + item.cantidad, 0),
    actualizarIndicadores,
  };

  actualizarIndicadores();
  window.addEventListener('storage', (event) => {
    if (event.key === CART_KEY) actualizarIndicadores();
  });
})();
