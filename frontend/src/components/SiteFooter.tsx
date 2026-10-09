import logoHorus from '../../../public/assets/logo-horus.png';

/** Pie común de las cuatro páginas de tienda. */
export function SiteFooter() {
  return (
    <footer className="market-footer">
      <div className="market-footer-content">
        <div>
          <a className="footer-brand" href="/market.html">
            <span className="brand-mark" aria-hidden="true">
              <img src={logoHorus} alt="" />
            </span>
            {' '}Horus Group
          </a>
          <p className="footer-copy">
            Soluciones tecnológicas y productos seleccionados para tus proyectos.
          </p>
        </div>
        <div>
          <h2 className="footer-heading">Market</h2>
          <nav className="footer-links" aria-label="Enlaces del Market">
            <a href="/market.html">Catálogo</a>
            <a href="/market-carrito.html">Mi carrito</a>
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
