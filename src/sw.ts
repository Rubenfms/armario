/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { PrecacheController, PrecacheRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkOnly } from 'workbox-strategies';
import type { WorkboxPlugin } from 'workbox-core';

/**
 * Service worker propio (vite-plugin-pwa en modo injectManifest). Hace lo
 * mismo que el generado antes: precache de la app, fallback a index.html y
 * caché del modelo de recorte. Y una cosa más que el generado no podía:
 *
 * GitHub Pages no permite cabeceras, y sin COOP/COEP el navegador no da
 * `SharedArrayBuffer`, así que onnxruntime recorta en un solo hilo (1–2 min
 * por prenda en móvil). Este SW añade esas cabeceras a TODAS las respuestas
 * que sirve; con la página controlada por él, `crossOriginIsolated` es true y
 * el recorte pasa a multihilo. Es el truco de coi-serviceworker, integrado
 * aquí para no tener dos service workers peleándose por el mismo scope.
 */

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

const BASE = import.meta.env.BASE_URL;

/** Añade las cabeceras de aislamiento. Las respuestas opacas no se pueden tocar. */
function withIsolationHeaders(response: Response): Response {
  if (response.status === 0 || response.type === 'opaque') return response;
  const headers = new Headers(response.headers);
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

const isolation: WorkboxPlugin = {
  handlerWillRespond: async ({ response }) => withIsolationHeaders(response),
};

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// Precache de la app (la lista la inyecta el plugin en build).
const precache = new PrecacheController({ plugins: [isolation] });
precache.precache(self.__WB_MANIFEST);
registerRoute(new PrecacheRoute(precache));

// Con HashRouter la única navegación real es a index.html; el resto va
// detrás del `#` y nunca llega al servidor ni al service worker.
registerRoute(new NavigationRoute(precache.createHandlerBoundToURL(`${BASE}index.html`)));

// Modelo ONNX y runtime WASM del recorte (~50 MB en trozos de 4 MB). Se
// descargan la primera vez que se recorta una prenda y a partir de ahí salen
// de aquí, también sin red. Las URLs llevan la versión del paquete: cambiarla
// invalida sola.
registerRoute(
  ({ url }) => url.origin === 'https://staticimgly.com' && url.pathname.startsWith('/@imgly/background-removal-data/'),
  new CacheFirst({
    cacheName: 'modelo-recorte',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      isolation,
    ],
  }),
);

// Todo lo demás va a la red tal cual, pero pasando por aquí para llevar las
// cabeceras: si algo se sirviera sin ellas, el navegador lo bloquearía en
// una página aislada.
registerRoute(() => true, new NetworkOnly({ plugins: [isolation] }));
