import { create } from 'zustand';
import { db } from '../db/db';
import { applyCutout } from '../db/garments';
import type { CutoutRequest, CutoutResponse } from '../workers/cutout.worker';

/**
 * Cola de recorte. Un solo worker y una prenda cada vez: el modelo ocupa
 * bastante memoria y en móvil dos inferencias a la vez lo tiran. El estado
 * por prenda vive en memoria (Zustand) para que las tarjetas pinten
 * «procesando»; no se persiste, y al arrancar se reencolan las prendas que
 * sigan sin recorte (`resumePendingCutouts`).
 */

export type CutoutStatus =
  | { state: 'cola' }
  | { state: 'procesando'; download: { current: number; total: number } | null }
  | { state: 'error'; message: string };

interface CutoutStore {
  jobs: Record<string, CutoutStatus>;
  setJob: (id: string, status: CutoutStatus) => void;
  clearJob: (id: string) => void;
}

export const useCutoutStore = create<CutoutStore>((set) => ({
  jobs: {},
  setJob: (id, status) => set((s) => ({ jobs: { ...s.jobs, [id]: status } })),
  clearJob: (id) =>
    set((s) => {
      const { [id]: _removed, ...rest } = s.jobs;
      return { jobs: rest };
    }),
}));

const queue: string[] = [];
let busy = false;
let worker: Worker | null = null;
let current: { id: string; resolve: (r: CutoutResponse) => void } | null = null;

export function enqueueCutout(id: string): void {
  const { jobs, setJob } = useCutoutStore.getState();
  const existing = jobs[id];
  if (existing && existing.state !== 'error') return;
  setJob(id, { state: 'cola' });
  queue.push(id);
  void pump();
}

/** Reencola las prendas activas que se quedaron sin recorte (cierre, fallo). */
export async function resumePendingCutouts(): Promise<void> {
  const pending = await db.garments.filter((g) => g.imageCutout === null && !g.archived).primaryKeys();
  for (const id of pending) enqueueCutout(id);
}

async function pump(): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    let id = queue.shift();
    while (id !== undefined) {
      await processOne(id);
      id = queue.shift();
    }
  } finally {
    busy = false;
  }
}

async function processOne(id: string): Promise<void> {
  const { setJob, clearJob } = useCutoutStore.getState();
  const garment = await db.garments.get(id);
  if (!garment) {
    clearJob(id);
    return;
  }

  setJob(id, { state: 'procesando', download: null });
  const response = await new Promise<CutoutResponse>((resolve) => {
    current = { id, resolve };
    const msg: CutoutRequest = { type: 'process', id, image: garment.imageOriginal };
    getWorker().postMessage(msg);
  });
  current = null;

  if (response.type === 'error') {
    console.error(`Recorte fallido (${garment.name}):`, response.message);
    setJob(id, { state: 'error', message: response.message });
    return;
  }
  if (response.type === 'done') {
    try {
      await applyCutout(id, response.cutout, response.color);
      clearJob(id);
    } catch (err) {
      console.error('No se pudo guardar el recorte', err);
      setJob(id, { state: 'error', message: 'No se pudo guardar el recorte' });
    }
  }
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/cutout.worker.ts', import.meta.url), { type: 'module' });

  worker.onmessage = (event: MessageEvent<CutoutResponse>) => {
    const msg = event.data;
    if (!current || msg.id !== current.id) return;
    if (msg.type === 'progress') {
      useCutoutStore.getState().setJob(msg.id, {
        state: 'procesando',
        download: { current: msg.current, total: msg.total },
      });
      return;
    }
    current.resolve(msg);
  };

  // Un error no capturado (p. ej. el WASM se queda sin memoria) tumba el
  // worker: se resuelve el trabajo en curso como fallido y se recrea el
  // worker en el siguiente uso.
  worker.onerror = (event) => {
    const failed = current;
    worker?.terminate();
    worker = null;
    failed?.resolve({ type: 'error', id: failed.id, message: event.message || 'El worker falló' });
  };

  return worker;
}
