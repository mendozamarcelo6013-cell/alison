import { createRoot } from 'react-dom/client';
import { ProductoPage } from '../pages/ProductoPage';
import { CartProvider } from '../state/CartContext';

const contenedor = document.getElementById('root');
if (contenedor) {
  createRoot(contenedor).render(
    <CartProvider>
      <ProductoPage />
    </CartProvider>,
  );
}
