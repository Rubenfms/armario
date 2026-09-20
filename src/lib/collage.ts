import type { Category, Garment } from '../db/types';
import { displayImage } from '../db/garmentImage';

/**
 * Collage de un outfit con posiciones fijas por categoría sobre un lienzo 3:4.
 * Nada de composición dinámica: cada categoría tiene su hueco y la prenda se
 * encaja dentro (contain, centrada). Los accesorios van en columna a la
 * derecha, hasta cuatro; el resto no se pinta.
 */

export const COLLAGE_WIDTH = 900;
export const COLLAGE_HEIGHT = 1200;

/** Caja en coordenadas normalizadas [0,1]: x, y, ancho, alto. */
export type Box = readonly [number, number, number, number];

export const SLOTS: Record<Exclude<Category, 'accesorio'>, Box> = {
  abrigo: [0.0, 0.02, 0.42, 0.5],
  superior: [0.25, 0.04, 0.5, 0.44],
  inferior: [0.25, 0.46, 0.5, 0.5],
  calzado: [0.66, 0.72, 0.32, 0.26],
};

export const ACCESSORY_SLOTS: readonly Box[] = [
  [0.8, 0.04, 0.18, 0.15],
  [0.8, 0.21, 0.18, 0.15],
  [0.8, 0.38, 0.18, 0.15],
  [0.8, 0.55, 0.18, 0.15],
];

/** Orden de pintado: lo que va detrás, primero. */
export const DRAW_ORDER: readonly Category[] = ['abrigo', 'inferior', 'superior', 'calzado', 'accesorio'];

/**
 * Devuelve `null` si no hay nada que pintar. El formato es WebP con alfa
 * donde el navegador sepa codificarlo; Safari devuelve PNG y vale igual.
 */
export async function renderCollage(garments: Garment[]): Promise<Blob | null> {
  if (garments.length === 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = COLLAGE_WIDTH;
  canvas.height = COLLAGE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el contexto 2D');

  for (const { garment, box } of placeGarments(garments)) {
    await drawContained(ctx, displayImage(garment), box);
  }

  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
}

/**
 * Asigna a cada prenda su caja, en orden de pintado. Lo comparten el canvas
 * (collage cacheado) y la versión en DOM (collage animado), para que ambos
 * coloquen las prendas exactamente igual.
 */
export function placeGarments(garments: Garment[]): Array<{ garment: Garment; box: Box }> {
  const placed: Array<{ garment: Garment; box: Box }> = [];
  let accessoryIndex = 0;
  for (const category of DRAW_ORDER) {
    for (const garment of garments.filter((g) => g.category === category)) {
      let box: Box | undefined;
      if (category === 'accesorio') {
        box = ACCESSORY_SLOTS[accessoryIndex];
        accessoryIndex += 1;
      } else {
        box = SLOTS[category];
      }
      if (box) placed.push({ garment, box });
    }
  }
  return placed;
}

async function drawContained(ctx: CanvasRenderingContext2D, image: Blob, [bx, by, bw, bh]: Box): Promise<void> {
  const bitmap = await createImageBitmap(image, { imageOrientation: 'from-image' });
  try {
    const boxW = bw * COLLAGE_WIDTH;
    const boxH = bh * COLLAGE_HEIGHT;
    const scale = Math.min(boxW / bitmap.width, boxH / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    const x = bx * COLLAGE_WIDTH + (boxW - w) / 2;
    const y = by * COLLAGE_HEIGHT + (boxH - h) / 2;
    ctx.drawImage(bitmap, x, y, w, h);
  } finally {
    bitmap.close();
  }
}
