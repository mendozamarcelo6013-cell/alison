import { Link } from 'react-router-dom';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';

/** Vista de página no encontrada (ruta `*`). */
export function PaginaNoEncontrada() {
  return (
    <>
      <SiteHeader>
        <div className="header-actions">
          <Link className="back-link" to="/market">← Volver al Market</Link>
        </div>
      </SiteHeader>

      <main className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Horus Market</p>
            <h1>Página no encontrada</h1>
            <p>La dirección que buscas no existe o cambió de lugar.</p>
          </div>
        </div>

        <section className="state-message" role="status">
          Vuelve al catálogo para seguir explorando el catálogo de Horus Group.
        </section>

        <p>
          <Link className="button-primary" to="/market">Ir al catálogo</Link>
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
