/// <reference types="vitest/config" />
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const directorioFrontend = path.dirname(fileURLToPath(import.meta.url));
const directorioProyecto = path.resolve(directorioFrontend, '..');
const directorioPublico = path.resolve(directorioProyecto, 'public');

const TIPOS: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
};

/**
 * En desarrollo los <link data-hojas> de index.html se resuelven como
 * `/public/css/*.css` (la ruta real queda fuera de `root`), y Vite devolvía el
 * shell HTML con `text/html`, lo que el navegador rechaza como hoja de estilo.
 * Este middleware sólo sirve ese prefijo en `serve`; en `build` no aplica.
 */
function servirPublicoEnDev(): Plugin {
  return {
    name: 'horus:public-en-dev',
    configureServer(servidor) {
      servidor.middlewares.use((peticion, respuesta, siguiente) => {
        const url = (peticion.url ?? '').split('?')[0];
        if (!url.startsWith('/public/')) return siguiente();

        const relativo = decodeURIComponent(url.slice('/public/'.length));
        const archivo = path.resolve(directorioPublico, relativo);

        if (!relativo || !archivo.startsWith(directorioPublico + path.sep)) return siguiente();

        fs.stat(archivo, (error, datos) => {
          if (error || !datos.isFile()) return siguiente();
          respuesta.setHeader('Content-Type', TIPOS[path.extname(archivo).toLowerCase()] ?? 'application/octet-stream');
          fs.createReadStream(archivo).pipe(respuesta);
        });
      });
    },
  };
}

// Solo se lee el puerto del backend. Ninguna variable privada se expone al
// navegador: Vite únicamente inyecta al cliente las claves VITE_*.
function puertoBackend(mode: string): number {
  const entorno = loadEnv(mode, directorioProyecto, '');
  const candidato = Number(entorno.PORT || process.env.PORT || 3000);
  return Number.isInteger(candidato) && candidato > 0 ? candidato : 3000;
}

const rutasProxy = ['/api', '/uploads', '/health'] as const;

export default defineConfig((config) => {
  const objetivo = `http://127.0.0.1:${puertoBackend(config.mode)}`;

  return {
    plugins: [react(), servirPublicoEnDev()],
    publicDir: false,
    build: {
      outDir: 'dist',
      assetsDir: 'static',
      emptyOutDir: true,
      // El polyfill de modulepreload se inyecta como <script> inline y el CSP
      // de /admin solo admite scripts same-origin externos.
      modulePreload: { polyfill: false },
      // SPA de entrada única: index.html (sin rollupOptions.input multipágina).
    },
    server: {
      fs: { allow: [directorioProyecto] },
      proxy: Object.fromEntries(
        rutasProxy.map((ruta) => [ruta, { target: objetivo, changeOrigin: false }]),
      ),
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./vitest.setup.ts'],
      include: ['tests/**/*.test.{ts,tsx}'],
      restoreMocks: true,
      clearMocks: true,
    },
  };
});
