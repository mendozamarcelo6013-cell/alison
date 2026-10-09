/// <reference types="vitest/config" />
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const directorioFrontend = path.dirname(fileURLToPath(import.meta.url));
const directorioProyecto = path.resolve(directorioFrontend, '..');

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
    plugins: [react()],
    publicDir: false,
    build: {
      outDir: 'dist',
      assetsDir: 'static',
      emptyOutDir: true,
      // El polyfill de modulepreload se inyecta como <script> inline y el CSP
      // de /admin.html solo admite scripts same-origin externos.
      modulePreload: { polyfill: false },
      rollupOptions: {
        input: {
          index: path.resolve(directorioFrontend, 'index.html'),
          market: path.resolve(directorioFrontend, 'market.html'),
          'market-producto': path.resolve(directorioFrontend, 'market-producto.html'),
          'market-carrito': path.resolve(directorioFrontend, 'market-carrito.html'),
          'market-checkout': path.resolve(directorioFrontend, 'market-checkout.html'),
          admin: path.resolve(directorioFrontend, 'admin.html'),
        },
      },
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
