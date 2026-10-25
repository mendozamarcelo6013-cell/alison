# Horus Market V2.1 — optimización de rendimiento, UX y accesibilidad

Rama: `feature/optimizacion-ux-v2.1`. Sin cambios en backend, BD, contratos REST ni autenticación.

## Decisiones
- **Caché**: `frontend/src/api/cache.ts` (stale-while-revalidate, vigencia 60 s, peticiones simultáneas compartidas).
  Se eligió frente a TanStack Query porque sólo hay dos lecturas y ninguna mutación; evita una dependencia.
- **Regla de seguridad**: la caché sólo alimenta catálogo y detalle. `consultarProducto` (carrito y checkout)
  siempre va a la red. El carrito muestra datos cacheados mientras valida, pero bloquea "Finalizar compra"
  hasta que el servidor confirma. Registrar un pedido invalida la caché.
- **Imágenes**: `loading=lazy` salvo la principal (`eager` + `fetchpriority=high`), `decoding=async`,
  proporción reservada, fundido de entrada, placeholder ante error. Galería: miniaturas, flechas, ← →,
  `aria-current`, región `status`, precarga sólo de la imagen siguiente.
- **Navegación**: filtros del catálogo y scroll se conservan al volver.
- **Checkout**: formulario por pasos en `/market/checkout` (validación en `utils/validacionCheckout.ts`),
  mismo payload que antes, bloqueo de doble envío.
- **Encabezado sticky**: su altura real se publica en `--header-alto` y el CSS la usa para scroll/sticky.

## Verificación
`npm run test:frontend`, `npm run build:frontend`, `npm run test:unit`. No ejecutar `npm test` en la raíz sin
revisar: `tests/admin-integracion.test.js` escribe en la BD configurada en `.env`.
Con `NODE_ENV=development` en `.env` el build local incluye React en modo desarrollo (~719 kB);
en Render (`production`) pesa ~367 kB.
