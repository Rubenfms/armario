import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { db } from './db/db';
import './styles.css';

// `autoUpdate`: el service worker nuevo toma el control solo y recarga la
// página. Sin prompts: es una app personal y prefiero tener siempre la última.
registerSW({ immediate: true });

// Dexie abre la base sola en la primera consulta, pero abrirla ya crea los
// almacenes y hace que un error de esquema salte al arrancar, no al usarla.
void db.open().catch((err: unknown) => console.error('No se pudo abrir la base de datos', err));

const root = document.getElementById('app');
if (!root) throw new Error('No existe #app en index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
