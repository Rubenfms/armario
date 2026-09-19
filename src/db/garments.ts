import { db } from './db';
import type { Category, Garment, Season } from './types';
import { makeThumbnail } from '../lib/images';
import type { DominantColor } from '../lib/color';
import { displayImage } from './garmentImage';
import { refreshCollagesFor, removeGarmentFromOutfits } from './outfits';

export { displayImage };

/** Los campos que edita el usuario en el formulario. */
export interface GarmentFields {
  name: string;
  category: Category;
  seasons: Season[];
  tags: string[];
  colorName: string;
}

export async function addGarment(fields: GarmentFields, photo: Blob): Promise<string> {
  // Un File arrastra nombre y fecha del sistema de ficheros; en IndexedDB solo
  // queremos los bytes. Además algunos Safari antiguos se atragantan con File.
  const imageOriginal = new Blob([await photo.arrayBuffer()], { type: photo.type });
  const thumbnail = await makeThumbnail(imageOriginal, 300);

  const garment: Garment = {
    id: crypto.randomUUID(),
    ...fields,
    // El color lo pone el worker de recorte cuando termina.
    colorHex: '',
    imageOriginal,
    imageCutout: null,
    thumbnail,
    // Preferencia: en cuanto haya recorte, usarlo. El usuario la cambia desde
    // el detalle si el recorte sale mal.
    useCutout: true,
    archived: false,
    createdAt: Date.now(),
  };
  await db.garments.add(garment);
  return garment.id;
}

export function updateGarment(id: string, fields: GarmentFields): Promise<number> {
  // Se desestructura porque UpdateSpec exige un objeto literal, no una interfaz.
  const { name, category, seasons, tags, colorName } = fields;
  return db.garments.update(id, { name, category, seasons, tags, colorName });
}

export function setGarmentArchived(id: string, archived: boolean): Promise<number> {
  return db.garments.update(id, { archived });
}

export async function deleteGarment(id: string): Promise<void> {
  await db.garments.delete(id);
  await removeGarmentFromOutfits(id);
}

/** Guarda el resultado del worker y rehace la miniatura según la preferencia. */
export async function applyCutout(id: string, cutout: Blob, color: DominantColor | null): Promise<void> {
  const garment = await db.garments.get(id);
  if (!garment) return;
  const thumbnail = await thumbnailFor({ ...garment, imageCutout: cutout });
  await db.garments.update(id, {
    imageCutout: cutout,
    thumbnail,
    ...(color ? { colorHex: color.hex, colorName: color.name } : {}),
  });
  await refreshCollagesFor(id);
}

/** Cambia entre recorte y original; la miniatura sigue a la elección. */
export async function setUseCutout(id: string, useCutout: boolean): Promise<void> {
  const garment = await db.garments.get(id);
  if (!garment) return;
  const thumbnail = await thumbnailFor({ ...garment, useCutout });
  await db.garments.update(id, { useCutout, thumbnail });
  await refreshCollagesFor(id);
}

function thumbnailFor(garment: Garment): Promise<Blob> {
  const transparent = garment.useCutout && garment.imageCutout !== null;
  return makeThumbnail(displayImage(garment), 300, { transparent });
}
