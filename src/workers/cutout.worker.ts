import { removeBackground, type Config } from '@imgly/background-removal';
import { dominantColor, type DominantColor } from '../lib/color';

/**
 * Worker de recorte: recibe la foto original, devuelve la prenda sobre fondo
 * transparente y su color dominante. Vive en un hilo aparte porque la
 * inferencia bloquea varios segundos, y el modelo se carga una sola vez por
 * vida del worker.
 */

export interface CutoutRequest {
  type: 'process';
  id: string;
  image: Blob;
}

export type CutoutResponse =
  | { type: 'progress'; id: string; key: string; current: number; total: number }
  | { type: 'done'; id: string; cutout: Blob; color: DominantColor | null }
  | { type: 'error'; id: string; message: string };

/** Lado mayor con el que se recorta. Ver nota en `prepareInput`. */
const MAX_SIDE = 1024;

/**
 * Los recursos (modelo ONNX + runtime WASM) vienen del CDN de IMG.LY y los
 * cachea el service worker (ver vite.config.ts). `isnet_quint8` es el modelo
 * pequeño (~40 MB); el mediano dobla la descarga por una mejora marginal en
 * fotos de ropa.
 */
const CONFIG: Config = {
  model: 'isnet_quint8',
  device: 'cpu',
  // WebP con alfa pesa una fracción del PNG. Donde el canvas no sepa
  // codificarlo (Safari) devuelve PNG solo, que también vale.
  output: { format: 'image/webp', quality: 0.9 },
};

self.onmessage = async (event: MessageEvent<CutoutRequest>) => {
  const { id, image } = event.data;
  try {
    const input = await prepareInput(image);
    const cutout = await removeBackground(input, {
      ...CONFIG,
      progress: (key, current, total) => {
        // También llegan claves compute:* (fases de la inferencia); solo la
        // descarga de recursos interesa al usuario.
        if (!key.startsWith('fetch:')) return;
        const msg: CutoutResponse = { type: 'progress', id, key, current, total };
        postMessage(msg);
      },
    });
    const color = await extractColor(cutout);
    const msg: CutoutResponse = { type: 'done', id, cutout, color };
    postMessage(msg);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const msg: CutoutResponse = { type: 'error', id, message };
    postMessage(msg);
  }
};

/**
 * Reduce la foto a 1024 px de lado mayor antes de recortar. El modelo trabaja
 * internamente a esa resolución, así que no se pierde calidad de recorte, y
 * el resultado con alfa pesa diez veces menos que a resolución de cámara.
 * De paso se corrige la orientación EXIF, que el modelo no mira.
 *
 * Se devuelve un Blob y no un ImageData: la librería dice aceptar ImageData
 * pero por dentro espera un ndarray y revienta.
 */
async function prepareInput(image: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(image, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Sin contexto 2D en el worker');
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  } finally {
    bitmap.close();
  }
}

async function extractColor(cutout: Blob): Promise<DominantColor | null> {
  const bitmap = await createImageBitmap(cutout);
  try {
    // Con 160 px de lado sobran píxeles para el k-means y se lee en nada.
    const scale = Math.min(1, 160 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = new OffscreenCanvas(width, height).getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    return dominantColor(data, width, height);
  } finally {
    bitmap.close();
  }
}
