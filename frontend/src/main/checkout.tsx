import { createRoot } from 'react-dom/client';
import { CheckoutPage } from '../pages/CheckoutPage';
import { CartProvider } from '../state/CartContext';

const contenedor = document.getElementById('root');
if (contenedor) {
  createRoot(contenedor).render(
    <CartProvider>
      <CheckoutPage />
    </CartProvider>,
  );
}
