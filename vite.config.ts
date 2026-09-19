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
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // El plugin usa esto para el scope y para las rutas del precache.
      base: BASE,
      scope: BASE,
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
        // Con HashRouter la única navegación real es a index.html; el resto
        // va detrás del `#` y nunca llega al servidor ni al service worker.
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
});
