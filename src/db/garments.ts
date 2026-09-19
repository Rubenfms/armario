import { db } from './db';
import type { Category, Garment, Season } from './types';
import { makeThumbnail } from '../lib/images';

/** Los campos que edita el usuario en el formulario. */
export interface GarmentFields {
  name: string;
  category: Category;
  seasons: Season[];
  tags: string[];
}

export async function addGarment(fields: GarmentFields, photo: Blob): Promise<string> {
  // Un File arrastra nombre y fecha del sistema de ficheros; en IndexedDB solo
  // queremos los bytes. Además algunos Safari antiguos se atragantan con File.
  const imageOriginal = new Blob([await photo.arrayBuffer()], { type: photo.type });
  const thumbnail = await makeThumbnail(imageOriginal, 300);

  const garment: Garment = {
    id: crypto.randomUUID(),
    ...fields,
    // El color se extrae en la Fase 2; hasta entonces queda vacío.
    colorHex: '',
    colorName: '',
    imageOriginal,
    imageCutout: null,
    thumbnail,
    useCutout: false,
    archived: false,
    createdAt: Date.now(),
  };
  await db.garments.add(garment);
  return garment.id;
}

export function updateGarment(id: string, fields: GarmentFields): Promise<number> {
  // Se desestructura porque UpdateSpec exige un objeto literal, no una interfaz.
  const { name, category, seasons, tags } = fields;
  return db.garments.update(id, { name, category, seasons, tags });
}

export function setGarmentArchived(id: string, archived: boolean): Promise<number> {
  return db.garments.update(id, { archived });
}

export function deleteGarment(id: string): Promise<void> {
  return db.garments.delete(id);
}
