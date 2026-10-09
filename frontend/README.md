# Horus Market — Frontend (React + TypeScript + Vite)

Migración del frontend vanilla (`public/*.html`, `public/js/*.js`) a una **SPA**
con React 19 + React Router 7 + TypeScript + Vite, sin tocar el backend Express.

Un único documento (`index.html`) y un único punto de montaje (`src/main.tsx`)
sirven a todas las rutas:

| Ruta | Vista | Página MPA equivalente |
| --- | --- | --- |
| `/market` | `CatalogoPage` | `market.html` |
| `/market/producto/:slug` | `ProductoPage` | `market-producto.html?slug=…` |
| `/market/carrito` | `CarritoPage` | `market-carrito.html` |
| `/market/checkout` | `CheckoutPage` | `market-checkout.html` |
| `/horus-admin` | `AdminPage` | `admin.html` |
| `*` | `PaginaNoEncontrada` | — |

Las URLs antiguas siguen funcionando: `src/app.js` responde **302** desde
`/market.html`, `/market-carrito.html`, `/market-checkout.html`, `/admin`, `/admin.html` y
`/market-producto.html?slug=…` hacia su ruta nueva (además existen rutas de
respaldo en el cliente para quien llegue con la URL vieja en el historial).

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

Las pruebas de integración del panel con base de datos (`tests/admin-integracion.test.js`)
se ejecutan aparte y sobre una base de pruebas; las suites sin MySQL son
`npm run test:unit` (en la raíz), que corre `tests/admin-unit.test.js` y
`tests/categoria-unit.test.js`.

## Cómo se conecta con el backend

- Todas las llamadas son relativas (`/api/...`): **en desarrollo** el proxy de Vite
  (`vite.config.ts`) reenvía `/api`, `/uploads` y `/health` a Express; **en
  producción** los sirve el propio Express.
- El puerto de Express se lee del `.env` de la raíz (`PORT`, por defecto 3000).
  Ninguna variable privada se expone al navegador: Vite sólo inyecta las claves
  `VITE_*` y no se usa ninguna.
- React nunca habla con MySQL: todo pasa por la API REST.
- `GET /api/categorias` conserva la lista plana y añade `parent_id`; React
  construye el árbol y calcula los descendientes por ID, sin nombres ni IDs
  codificados en los componentes.
- El panel usa `POST/PUT/DELETE/PATCH /api/admin/categorias` para el CRUD
  autenticado y registra las mutaciones en auditoría. `DELETE` es desactivación
  lógica y bloquea categorías con productos o subcategorías activas.
- Los destinos externos opcionales de categorías se configuran mediante
  `VITE_CATEGORY_EXTERNAL_URLS` como JSON `{ "slug": "https://..." }`. Si no
  existe configuración válida, las categorías siguen siendo filtros normales y
  no muestran un enlace externo ficticio.
- En desarrollo, `vite.config.ts` sirve además `/public/css/*.css` (fuera de
  `root`) con el MIME correcto para los `<link>` del shell.

## Rutas y CSS sin conflictos

El CSS original se cargaba por documento (dos hojas por página); en una sola SPA
esas hojas chocan entre sí (`.quantity-control`, `.summary-card`,
`.product-name`, `h1`/`h2` globales…). La solución no es inyectar `<style>`:
el CSP de `/horus-admin` sólo admite `style-src 'self'` y bloquearía cualquier nodo
creado por script.

Por eso `index.html` enlaza **una sola vez** cada hoja con `media="not all"` y
`data-hojas`, y `src/styles/HojasDeRuta.tsx` alterna `media="all"` en el
`layout effect` de cada ruta (`src/styles/hojas.ts` define qué hojas activa cada
ruta, con el mismo orden de cascada que el MPA). En `/horus-admin` sólo está activa
`admin.css`, igual que en el documento antiguo.

## Navegación

- Enlaces internos con `<Link>` y saltos con `useNavigate()`; sin recargas de
  documento. `window.location`/`location.href` sólo se conservan para abrir una
  URL externa (el `checkout_url` de la pasarela) en pestaña nueva.
- El estado del carrito vive en `CartProvider` (montado en `main.tsx`), por lo
  que sobrevive a los cambios de ruta.

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
npm run build:frontend   # genera frontend/dist (index.html + /static)
npm start                # Express sirve frontend/dist y, si falta algo, public/
```

`src/app.js` monta `frontend/dist` antes que `public/`. El catch-all responde el
shell SPA con `Cache-Control: no-cache` para cualquier GET/HEAD de navegación
que no sea un recurso, `/api`, `/uploads` o un fichero con extensión; los JSON
404 y las respuestas con cuerpo siguen intactos. Si `dist` no existe, el
servidor responde el frontend vanilla original, por lo que sirve también como
vuelta atrás.

El panel conserva el CSP `script-src 'self'`: por eso la build desactiva el
polyfill de `modulepreload` (inyecta un script inline) y ninguna hoja se
inyecta como `<style>`.

## Estructura

```
index.html      shell de la SPA (raíz + los <link data-hojas> + main.tsx)
src/
  main.tsx      único punto de montaje: BrowserRouter → CartProvider → App
  App.tsx       rutas, títulos por vista y compatibilidad con las URLs .html
  api/          capa HTTP (client.ts, productos, pedidos, pagos, admin)
  components/   cabecera, pie, imágenes, Modal del panel
  hooks/        useToasts
  pages/        una página por vista + pages/admin/*
  state/        CartContext + persistencia del carrito
  styles/       hojas.ts (qué CSS activa cada ruta) + HojasDeRuta.tsx
  types/        contratos reales de la API
  utils/        formato, navegación
tests/          suites Vitest (rutas, catálogo, producto, carrito, checkout, admin)
```
