import type { Garment } from './types';

/** Imagen con la que se pinta la prenda (rejilla, collages). */
export function displayImage(garment: Garment): Blob {
  return garment.useCutout && garment.imageCutout ? garment.imageCutout : garment.imageOriginal;
}
