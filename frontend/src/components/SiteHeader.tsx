import type { ReactNode } from 'react';
import logoHorus from '../../../public/assets/logo-horus.png';

interface Props {
  hrefMarca?: string;
  etiquetaMarca?: string;
  children: ReactNode;
}

/** Cabecera común de las cuatro páginas de tienda (clases del CSS original). */
export function SiteHeader({ hrefMarca = '/market.html', etiquetaMarca, children }: Props) {
  return (
    <header className="site-header">
      <div className="header-content">
        <a className="brand" href={hrefMarca} aria-label={etiquetaMarca || 'Volver a Horus Market'}>
          <span className="brand-mark" aria-hidden="true">
            <img src={logoHorus} alt="" />
          </span>
          <span>
            <strong>Horus Group</strong>
            <span className="brand-section">Market</span>
          </span>
        </a>
        {children}
      </div>
    </header>
  );
}

const ICONO_CARRITO_CATALOGO = (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M0 0h16v16H0z" fill="none" />
    <path
      fill="currentColor"
      d="M5.5 12a1.5 1.5 0 1 1 0 3.001a1.5 1.5 0 0 1 0-3m6-.001a1.5 1.5 0 1 1 0 3.001a1.5 1.5 0 0 1 0-3M3.364 2.047l.151.017a1 1 0 0 1 .756.647l.813 2.29h8.529a1 1 0 0 1 .948 1.315l-1.333 4a1 1 0 0 1-.948.684H5.72c-.43 0-.813-.276-.95-.684l-1.2-3.603l-.956-2.692l-.649-.022a1 1 0 0 1 .069-1.998z"
    />
  </svg>
);

const ICONO_CARRITO = (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
    />
  </svg>
);

interface PropsEnlaceCarrito {
  unidades: number;
  /** Usa el icono del catálogo (cuadrado) en lugar del carrito de línea. */
  iconoCatalogo?: boolean;
}

/** Enlace al carrito con el contador de unidades (data-cart-count). */
export function EnlaceCarrito({ unidades, iconoCatalogo = false }: PropsEnlaceCarrito) {
  return (
    <a className="cart-link" href="/market-carrito.html">
      {iconoCatalogo ? ICONO_CARRITO_CATALOGO : ICONO_CARRITO}
      <span>
        Carrito (<span data-cart-count>{unidades}</span>)
      </span>
    </a>
  );
}

/** Enlace "Administrar" del catálogo. */
export function EnlaceAdmin() {
  return (
    <a className="cart-link admin-link" href="/admin.html" aria-label="Ingresar al panel de administración">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.8"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 6h3m-3 4h3m-6.75 8.25h10.5A2.25 2.25 0 0 0 19.5 16V5.25A2.25 2.25 0 0 0 17.25 3h-10.5A2.25 2.25 0 0 0 4.5 5.25V16a2.25 2.25 0 0 0 2.25 2.25ZM7.5 21h9"
        />
      </svg>
      <span>Administrar</span>
    </a>
  );
}
