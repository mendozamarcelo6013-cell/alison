import { createRoot } from 'react-dom/client';
import { CatalogoPage } from '../pages/CatalogoPage';
import { CartProvider } from '../state/CartContext';

const contenedor = document.getElementById('root');
if (contenedor) {
  createRoot(contenedor).render(
    <CartProvider>
      <CatalogoPage />
    </CartProvider>,
  );
}
