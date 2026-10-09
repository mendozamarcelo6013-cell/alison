import { createRoot } from 'react-dom/client';
import { CarritoPage } from '../pages/CarritoPage';
import { CartProvider } from '../state/CartContext';

const contenedor = document.getElementById('root');
if (contenedor) {
  createRoot(contenedor).render(
    <CartProvider>
      <CarritoPage />
    </CartProvider>,
  );
}
