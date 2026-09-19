/**
 * Modelo de datos tal como está en PLAN.md §2. Las imágenes van como Blob
 * directamente en IndexedDB: Dexie las guarda sin pasar por base64.
 */

export const CATEGORIES = ['superior', 'inferior', 'calzado', 'abrigo', 'accesorio'] as const;
export type Category = (typeof CATEGORIES)[number];

export const SEASONS = ['primavera', 'verano', 'otono', 'invierno'] as const;
export type Season = (typeof SEASONS)[number];

export interface Garment {
  id: string;
  name: string; // "Camisa lino beige"
  category: Category;
  seasons: Season[]; // vacío = todo el año
  colorHex: string; // dominante, extraído automáticamente
  colorName: string; // nombre aproximado, editable
  tags: string[]; // libres: "oficina", "boda", "cómodo"
  imageOriginal: Blob;
  imageCutout: Blob | null; // null mientras no se haya procesado
  thumbnail: Blob; // 300px, para la rejilla
  useCutout: boolean; // si false, se usa la original en los collages
  archived: boolean;
  createdAt: number;
}

export interface Outfit {
  id: string;
  name: string;
  garmentIds: string[];
  tags: string[];
  collage: Blob | null; // render cacheado; null si no hay prendas con imagen
  createdAt: number;
}

export interface WearLog {
  id: string;
  date: string; // YYYY-MM-DD
  garmentIds: string[];
  outfitId: string | null;
  source: 'sugerido' | 'manual';
}
