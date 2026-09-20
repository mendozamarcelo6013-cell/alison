# Horus Market Lab — Fase 1

Laboratorio aislado para diseñar y validar la base de datos de Market. No comparte código ni utiliza la base `horus_db` del sitio actual.

## Entornos: Clever Cloud para pruebas y hosting final

La aplicación se conecta a MySQL exclusivamente por variables de entorno. En este laboratorio, Clever Cloud puede utilizarse como base de datos remota de **pruebas**. El archivo local `.env` está ignorado por Git y nunca debe subirse al repositorio.

Para el hosting final, el archivo `render.yaml` sirve como referencia del servicio Node, el comando `npm ci`, el inicio con `npm start` y el health check `/health`. Al desplegar, configura en el hosting las variables `DB_HOST`, `DB_NAME`, `DB_USER` y `DB_PASS` de la base que vaya a utilizarse. Mantén `DB_PORT=3306`, `DB_DIALECT=mysql` y activa `DB_SSL=true` solo si el proveedor exige TLS.

### Secretos según el entorno

`ADMIN_SESSION_SECRET` firma los tokens del panel administrativo. La línea que aparece en `.env.example` (`cambia-esto-por-64-caracteres-aleatorios`) es únicamente un texto de ejemplo y no debe usarse como secreto real.

- En Clever Cloud para **pruebas**, configura un secreto de pruebas en sus variables de entorno o en el `.env` local. No lo subas a Git.
- Antes de migrar a un hosting de **producción**, genera un secreto nuevo y aleatorio, por ejemplo con `openssl rand -hex 32`, y guárdalo como variable secreta del hosting.
- En producción el servidor no inicia sin `ADMIN_SESSION_SECRET` de al menos 32 caracteres. Cambiarlo invalida los tokens administrativos existentes.
- `ADMIN_PASSWORD` es solo la contraseña inicial usada por `npm run db:seed:admin`; no es el mismo secreto que `ADMIN_SESSION_SECRET`.

## Panel admin (`/admin.html`)

El panel exige login con usuario de rol `admin` (token Bearer, sin cookies: no hay superficie CSRF). Sin token, toda `/api/admin/*` responde 401/403.

1. Para pruebas, define `ADMIN_SESSION_SECRET` en tu `.env` o en Clever Cloud. Para producción, usa un secreto nuevo generado aleatoriamente; el servidor no arranca sin él.
2. Crea el primer admin: `ADMIN_EMAIL=... ADMIN_PASSWORD=...(mín. 10 caracteres) npm run db:seed:admin`.
3. Abre `/admin.html`, inicia sesión y gestiona el catálogo. El borrado es solo papelera (restaurable); no hay borrado definitivo por HTTP.
4. Todo cambio de stock exige motivo y genera `MovimientoStock`; toda mutación queda en `auditoria_admin` (visible en la pestaña Actividad).

### Imágenes de productos

El panel permite subir varias imágenes JPG, JPEG, PNG o WEBP de hasta `PRODUCT_IMAGE_MAX_MB` MB cada una. El proveedor `local` las guarda en `PRODUCT_UPLOADS_DIR/{producto_id}/` y Express las publica en `/uploads/productos/...`; la base de datos solo conserva rutas relativas. La relación existente `producto_imagenes` usa `principal` como equivalente de `es_principal`; las operaciones administrativas mantienen una sola portada por producto.

`PUBLIC_BASE_URL` permite construir URLs absolutas en las respuestas API sin guardar el dominio. En un VPS, configura `PRODUCT_UPLOADS_DIR` fuera del código, restaura la base de datos y copia ese directorio conservando su estructura; los registros `/uploads/productos/...` seguirán siendo válidos. En Render, el filesystem local no es permanente: debe implementarse un proveedor persistente (S3, Cloudinary o equivalente) detrás de `src/services/imagenProducto.js`, conservando las mismas rutas lógicas y el mismo modelo de datos.

## Despliegue multirréplica

El rate-limit es en memoria **por instancia** (`LOGIN_RATE_MAX`, `ADMIN_RATE_MAX` por minuto). Con una sola réplica basta. Con varias réplicas, el límite debe aplicarse en el reverse-proxy (p. ej. límite por IP en Nginx/Cloudflare) o migrar el contador a un almacén compartido (Redis); de lo contrario cada réplica aplica su propio cupo. De igual forma, `TRUST_PROXY` debe reflejar solo los saltos reales: `0` en directo, `1` tras el proxy de Render.

## Preparación

1. Crea una base vacía en MySQL: `CREATE DATABASE horus_market_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
2. Copia `.env.example` como `.env` y coloca las credenciales de esa base.
3. Instala dependencias: `npm install`.
4. Ejecuta el esquema: `npm run db:migrate`.
5. Carga el catálogo de prueba: `npm run db:seed`.

`npm run db:reset` elimina únicamente las tablas creadas por las migraciones de este laboratorio y las vuelve a crear con sus datos de muestra. Úsalo solo sobre la base de pruebas.

## Alcance de esta fase

- Usuarios y direcciones.
- Catálogo: categorías, productos, imágenes y stock.
- Pedidos con ítems y valores históricos.
- Pagos manuales, comprobantes y envíos.
- Auditoría de movimientos de inventario.

Los precios están en soles e incluyen IGV. El backend futuro debe recalcular precios y validar el stock en una transacción; el navegador no es una fuente confiable para esos valores.
