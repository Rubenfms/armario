/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * OJO: GitHub Pages sirve el sitio bajo /<nombre-del-repo>/, no en la raíz.
 * Si el repo no se llama `armario` hay que cambiar esto o la app cargará en
 * blanco con un puñado de 404. Es el fallo típico.
 *
 * Todo lo que dependa de esta ruta (assets, scope del service worker,
 * navigateFallback, start_url del manifest) sale de aquí o de
 * `import.meta.env.BASE_URL`. No la escribas a mano en ningún otro sitio.
 */
const BASE = '/armario/';

export default defineConfig({
  base: BASE,
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  // El worker de recorte carga onnxruntime con import() dinámico; el formato
  // iife de los workers no lo soporta.
  worker: { format: 'es' },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // El plugin usa esto para el scope y para las rutas del precache.
      base: BASE,
      scope: BASE,
      // Iconos y pantallas de arranque: pequeños y los pide el sistema, no la app.
      includeAssets: ['icons/*.png', '.nojekyll'],
      manifest: {
        id: BASE,
        name: 'Armario',
        short_name: 'Armario',
        description: 'Mi ropa, mis outfits y una sugerencia diaria. Funciona sin conexión.',
        lang: 'es',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1c1917',
        theme_color: '#1c1917',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // onnxruntime trae variante WebGPU y sus propios .wasm/.mjs; el worker
        // solo usa la variante WASM, y el runtime real llega del CDN de IMG.LY.
        globIgnores: ['**/ort.webgpu*', '**/*.wasm', '**/*.mjs'],
        // Con HashRouter la única navegación real es a index.html; el resto
        // va detrás del `#` y nunca llega al servidor ni al service worker.
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Modelo ONNX y runtime WASM del recorte de fondo (~50 MB en
            // trozos de 4 MB). Se descargan la primera vez que se recorta
            // una prenda y a partir de ahí salen de aquí, también sin red.
            // Las URLs llevan la versión del paquete: cambiarla invalida sola.
            urlPattern: /^https:\/\/staticimgly\.com\/@imgly\/background-removal-data\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'modelo-recorte',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
