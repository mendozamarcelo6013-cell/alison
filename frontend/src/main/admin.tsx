import { createRoot } from 'react-dom/client';
import { AdminPage } from '../pages/AdminPage';

const contenedor = document.getElementById('root');
if (contenedor) {
  createRoot(contenedor).render(<AdminPage />);
}
