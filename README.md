# Horus Market Lab — Fase 1

Laboratorio aislado para diseñar y validar la base de datos de Market. No comparte código ni utiliza la base `horus_db` del sitio actual.

## Producción: Clever Cloud + Render

La aplicación se conecta a MySQL exclusivamente por variables de entorno. El archivo local `.env` está ignorado por Git y debe contener las credenciales de Clever Cloud; nunca lo subas al repositorio.

Para Render, el archivo `render.yaml` define el servicio Node, el comando `npm ci`, el inicio con `npm start` y el health check `/health`. Al crear el servicio, configura en Render los secretos `DB_HOST`, `DB_NAME`, `DB_USER` y `DB_PASS` con los valores de Clever Cloud. Mantén `DB_PORT=3306`, `DB_DIALECT=mysql` y, salvo que Clever Cloud exija TLS, `DB_SSL=false`.

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
