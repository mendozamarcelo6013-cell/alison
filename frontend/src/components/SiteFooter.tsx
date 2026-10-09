import { Link } from 'react-router-dom';
import logoHorus from '../../../public/assets/logo-horus.png';

/** Pie común de las páginas de tienda. */
export function SiteFooter() {
  return (
    <footer className="market-footer">
      <div className="market-footer-content">
        <div>
          <Link className="footer-brand" to="/market">
            <span className="brand-mark" aria-hidden="true">
              <img src={logoHorus} alt="" />
            </span>
            {' '}Horus Group
          </Link>
          <p className="footer-copy">
            Soluciones tecnológicas y productos seleccionados para tus proyectos.
          </p>
        </div>
        <div>
          <h2 className="footer-heading">Market</h2>
          <nav className="footer-links" aria-label="Enlaces del Market">
            <Link to="/market">Catálogo</Link>
            <Link to="/market/carrito">Mi carrito</Link>
          </nav>
        </div>
        <div>
          <h2 className="footer-heading">Contacto</h2>
          <p className="footer-contact">Cajamarca, Perú</p>
          <p className="footer-contact">horusgroupcajamarca@gmail.com</p>
        </div>
      </div>
      <div className="footer-bottom">© 2026 Horus Group SRL. Todos los derechos reservados.</div>
    </footer>
  );
}
