import { db } from './db';
import type { Garment, Outfit } from './types';
import { renderCollage } from '../lib/collage';

/** Los campos que edita el usuario en el editor de outfits. */
export interface OutfitFields {
  name: string;
  garmentIds: string[];
  tags: string[];
}

export async function addOutfit(fields: OutfitFields): Promise<string> {
  const outfit: Outfit = {
    id: crypto.randomUUID(),
    ...fields,
    collage: await collageFor(fields.garmentIds),
    createdAt: Date.now(),
  };
  await db.outfits.add(outfit);
  return outfit.id;
}

export async function updateOutfit(id: string, fields: OutfitFields): Promise<number> {
  const { name, garmentIds, tags } = fields;
  const collage = await collageFor(garmentIds);
  return db.outfits.update(id, { name, garmentIds, tags, collage });
}

export function deleteOutfit(id: string): Promise<void> {
  return db.outfits.delete(id);
}

/** Rehace los collages de los outfits que contienen la prenda. */
export async function refreshCollagesFor(garmentId: string): Promise<void> {
  const outfits = await db.outfits.where('garmentIds').equals(garmentId).toArray();
  for (const outfit of outfits) {
    const collage = await collageFor(outfit.garmentIds);
    await db.outfits.update(outfit.id, { collage });
  }
}

/** Al borrar una prenda, sale de sus outfits y estos se vuelven a pintar. */
export async function removeGarmentFromOutfits(garmentId: string): Promise<void> {
  const outfits = await db.outfits.where('garmentIds').equals(garmentId).toArray();
  for (const outfit of outfits) {
    const garmentIds = outfit.garmentIds.filter((id) => id !== garmentId);
    const collage = await collageFor(garmentIds);
    await db.outfits.update(outfit.id, { garmentIds, collage });
  }
}

/** Prendas de un outfit en el orden guardado, saltando las que ya no existen. */
export async function garmentsOf(garmentIds: string[]): Promise<Garment[]> {
  const found = await db.garments.bulkGet(garmentIds);
  return found.filter((g): g is Garment => g !== undefined);
}

async function collageFor(garmentIds: string[]): Promise<Blob | null> {
  return renderCollage(await garmentsOf(garmentIds));
}
