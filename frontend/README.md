# Horus Market — Frontend (React + TypeScript + Vite)

Migración del frontend vanilla (`public/*.html`, `public/js/*.js`) a React 19 + TypeScript + Vite, sin tocar el backend Express.

| Página | Entrada |
| --- | --- |
| `market.html` | `src/main/market.tsx` → `src/pages/CatalogoPage.tsx` |
| `market-producto.html` | `src/main/producto.tsx` → `src/pages/ProductoPage.tsx` |
| `market-carrito.html` | `src/main/carrito.tsx` → `src/pages/CarritoPage.tsx` |
| `market-checkout.html` | `src/main/checkout.tsx` → `src/pages/CheckoutPage.tsx` |
| `admin.html` | `src/main/admin.tsx` → `src/pages/AdminPage.tsx` |
| `/` | `index.html` (redirección a `market.html`) |

## Comandos

```bash
npm install          # sólo la primera vez
npm run dev          # Vite en 5173, proxea /api, /uploads y /health a Express
npm run typecheck    # tsc --noEmit (modo estricto, sin any)
npm run test         # Vitest (jsdom + Testing Library)
npm run build        # typecheck + vite build → frontend/dist
npm run preview      # sirve frontend/dist en local
```

Desde la raíz del proyecto también están disponibles:

```bash
npm run build:frontend   # npm --prefix frontend run build
npm run test:frontend
npm run dev:frontend
```

## Cómo se conecta con el backend

- Todas las llamadas son relativas (`/api/...`): **en desarrollo** el proxy de Vite
  (`vite.config.ts`) reenvía `/api`, `/uploads` y `/health` a Express; **en
  producción** los sirve el propio Express.
- El puerto de Express se lee del `.env` de la raíz (`PORT`, por defecto 3000).
  Ninguna variable privada se expone al navegador: Vite sólo inyecta las claves
  `VITE_*` y no se usa ninguna.
- React nunca habla con MySQL: todo pasa por la API REST.

## Convenciones que no se han cambiado

- Carrito: `localStorage["horus_market_cart"]` con `{producto_id, slug, cantidad}`.
  El precio y el stock finales siempre los decide Express.
- Sesión del panel: `sessionStorage["horus_admin_token"]` (nunca `localStorage`).
- Último pedido: `sessionStorage["horus_market_last_order"]`.
- Nombres de campo JSON idénticos a los del backend (`producto_id`, `categoria_id`,
  `descripcion_corta`, `controla_stock`, `motivo_stock`, `numero_pedido`,
  `igv_total`, `envio_total`, `texto_alternativo`, `principal`, `direccion_linea1`,
  `principal_index`, `imagenes`…).
- Acciones en lote del panel = una petición individual por producto (no existe
  endpoint bulk). El borrado es papelera (borrado lógico) y todo cambio de stock
  exige `motivo_stock`.
- Estilos: se reutiliza el CSS original de `public/css/` sin cambiar colores,
  tipografías ni breakpoints. No se usa Tailwind, Bootstrap ni MUI.

## Producción

```bash
npm run build:frontend   # genera frontend/dist con los 5 HTML
npm start                # Express sirve frontend/dist y, si falta algo, public/
```

`src/app.js` monta `frontend/dist` antes que `public/`. Si `dist` no existe,
el servidor responde el frontend vanilla original, por lo que sirve también como
vuelta atrás. El panel conserva el CSP `script-src 'self'`: por eso la build
desactiva el polyfill de `modulepreload` (inyecta un script inline).

## Estructura

```
src/
  api/        capa HTTP (client.ts, productos, pedidos, pagos, admin)
  components/ cabecera, pie, imágenes, Modal del panel
  hooks/      useToasts
  pages/      una página por documento + pages/admin/*
  state/      CartContext + persistencia del carrito
  types/      contratos reales de la API
  utils/      formato, navegación
tests/        suites Vitest (catálogo, producto, carrito, checkout, admin)
```
