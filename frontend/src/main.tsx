import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { CartProvider } from './state/CartContext';

const contenedor = document.getElementById('root');
if (contenedor) {
  createRoot(contenedor).render(
    <BrowserRouter>
      <CartProvider>
        <App />
      </CartProvider>
    </BrowserRouter>,
  );
}
