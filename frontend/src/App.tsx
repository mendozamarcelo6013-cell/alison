import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { AdminPage } from './pages/AdminPage';
import { CarritoPage } from './pages/CarritoPage';
import { CatalogoPage } from './pages/CatalogoPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { PaginaNoEncontrada } from './pages/PaginaNoEncontrada';
import { ProductoPage } from './pages/ProductoPage';
import { HojasDeRuta } from './styles/HojasDeRuta';

/**
 * Compatibilidad con el enlace antiguo `market-producto.html?slug=...`: se
 * resuelve en el cliente para no perder la URL del producto compartida.
 */
function CompatProducto() {
  const [parametros] = useSearchParams();
  const slug = parametros.get('slug')?.trim() ?? '';
  return <Navigate to={slug ? `/market/producto/${encodeURIComponent(slug)}` : '/market'} replace />;
}

function tituloPara(ruta: string): string {
  if (ruta === '/market') return 'Market | Horus Group';
  if (ruta.startsWith('/market/producto')) return 'Producto | Horus Market';
  if (ruta.startsWith('/market/carrito')) return 'Carrito | Horus Market';
  if (ruta.startsWith('/market/checkout')) return 'Finalizar compra | Horus Market';
  if (
    ruta === '/horus-admin'
    || ruta.startsWith('/horus-admin/')
    || ruta === '/admin'
    || ruta.startsWith('/admin/')
    || ruta === '/admin.html'
  ) {
    return 'Panel de administración | Horus Market';
  }
  return 'Página no encontrada | Horus Market';
}

export function App() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = tituloPara(pathname);
  }, [pathname]);

  return (
    <>
      <HojasDeRuta />
      <Routes>
        <Route path="/" element={<Navigate to="/market" replace />} />

        <Route path="/market" element={<CatalogoPage />} />
        <Route path="/market/producto/:slug" element={<ProductoPage />} />
        <Route path="/market/producto" element={<ProductoPage />} />
        <Route path="/market/carrito" element={<CarritoPage />} />
        <Route path="/market/checkout" element={<CheckoutPage />} />

        <Route path="/horus-admin" element={<AdminPage />} />
        <Route path="/admin" element={<Navigate to="/horus-admin" replace />} />

        <Route path="/market.html" element={<Navigate to="/market" replace />} />
        <Route path="/market-producto.html" element={<CompatProducto />} />
        <Route path="/market-carrito.html" element={<Navigate to="/market/carrito" replace />} />
        <Route path="/market-checkout.html" element={<Navigate to="/market/checkout" replace />} />
        <Route path="/admin.html" element={<Navigate to="/horus-admin" replace />} />

        <Route path="*" element={<PaginaNoEncontrada />} />
      </Routes>
    </>
  );
}
