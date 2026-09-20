import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { ErrorBoundary, ErrorScreen } from './ui/ErrorBoundary';
import { db } from './db/db';
import { resumePendingCutouts } from './lib/cutout';
import './styles.css';

// `autoUpdate`: el service worker nuevo toma el control solo y recarga la
// página. Sin prompts: es una app personal y prefiero tener siempre la última.
registerSW({ immediate: true });

// La primera carga de todas llega sin service worker y, por tanto, sin las
// cabeceras COOP/COEP que este añade (ver src/sw.ts): la página no está
// aislada y el recorte iría a un hilo. En cuanto el SW toma el control, una
// recarga (solo una: sessionStorage lo guarda) deja la app aislada. En las
// actualizaciones el plugin ya recarga por su cuenta y esto no hace nada.
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (crossOriginIsolated) return;
  try {
    if (sessionStorage.getItem('armario:coi-reload')) return;
    sessionStorage.setItem('armario:coi-reload', '1');
  } catch {
    // Sin sessionStorage se recarga igualmente; el guard es solo por si acaso.
  }
  window.location.reload();
});

// Dexie abre la base sola en la primera consulta, pero abrirla ya crea los
// almacenes y hace que un error de esquema salte al arrancar, no al usarla.
const root = document.getElementById('app');
if (!root) throw new Error('No existe #app en index.html');
const reactRoot = createRoot(root);

void db
  .open()
  .then(() => {
    reactRoot.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
    return resumePendingCutouts();
  })
  .catch((err: unknown) => {
    // Sin base de datos no hay app: modo privado estricto, cuota a cero o
    // un esquema más nuevo de otra pestaña. Mejor decirlo que quedarse en blanco.
    console.error('No se pudo abrir la base de datos', err);
    const message = err instanceof Error ? err.message : String(err);
    reactRoot.render(<ErrorScreen title="No se pudo abrir el almacén" message={message} />);
  });
