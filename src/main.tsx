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
