import { unzip, zip, type Unzipped, type Zippable } from 'fflate';
import { db } from '../db/db';
import type { Garment, Outfit, WearLog } from '../db/types';

/**
 * Copia de seguridad completa en un .zip: un `armario.json` con los registros
 * y las imágenes como ficheros sueltos referenciados por ruta. Todo lo que
 * hay en IndexedDB vive solo en este dispositivo; esto es la única salida.
 *
 * Formato (versión 1):
 *   armario.json
 *   garments/<id>/original.<ext> | cutout.<ext> | thumbnail.<ext>
 *   outfits/<id>/collage.<ext>
 */

export const BACKUP_VERSION = 1;

interface ImageRef {
  path: string;
  type: string;
}

interface BackupGarment extends Omit<Garment, 'imageOriginal' | 'imageCutout' | 'thumbnail'> {
  imageOriginal: ImageRef;
  imageCutout: ImageRef | null;
  thumbnail: ImageRef;
}

interface BackupOutfit extends Omit<Outfit, 'collage'> {
  collage: ImageRef | null;
}

export interface BackupManifest {
  app: 'armario';
  version: number;
  exportedAt: string;
  garments: BackupGarment[];
  outfits: BackupOutfit[];
  wearLogs: WearLog[];
}

export interface BackupSummary {
  garments: number;
  outfits: number;
  wearLogs: number;
}

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function extFor(blob: Blob): string {
  return EXT[blob.type] ?? 'bin';
}

// --------------------------------------------------------------- exportar

export async function exportBackup(onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const [garments, outfits, wearLogs] = await Promise.all([
    db.garments.toArray(),
    db.outfits.toArray(),
    db.wearLogs.toArray(),
  ]);

  const files: Zippable = {};
  const total = garments.length + outfits.length;
  let done = 0;

  const put = async (path: string, blob: Blob): Promise<ImageRef> => {
    // Las imágenes ya vienen comprimidas: nivel 0 para no perder tiempo.
    files[path] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
    return { path, type: blob.type };
  };

  const backupGarments: BackupGarment[] = [];
  for (const g of garments) {
    const dir = `garments/${g.id}`;
    backupGarments.push({
      ...g,
      imageOriginal: await put(`${dir}/original.${extFor(g.imageOriginal)}`, g.imageOriginal),
      imageCutout: g.imageCutout ? await put(`${dir}/cutout.${extFor(g.imageCutout)}`, g.imageCutout) : null,
      thumbnail: await put(`${dir}/thumbnail.${extFor(g.thumbnail)}`, g.thumbnail),
    });
    done += 1;
    onProgress?.(done, total);
  }

  const backupOutfits: BackupOutfit[] = [];
  for (const o of outfits) {
    backupOutfits.push({
      ...o,
      collage: o.collage ? await put(`outfits/${o.id}/collage.${extFor(o.collage)}`, o.collage) : null,
    });
    done += 1;
    onProgress?.(done, total);
  }

  const manifest: BackupManifest = {
    app: 'armario',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    garments: backupGarments,
    outfits: backupOutfits,
    wearLogs,
  };
  files['armario.json'] = [new TextEncoder().encode(JSON.stringify(manifest)), { level: 6 }];

  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    zip(files, (err, data) => (err ? reject(err) : resolve(data)));
  });
  return new Blob([toArrayBuffer(bytes)], { type: 'application/zip' });
}

export function backupFileName(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `armario-${y}-${m}-${d}.zip`;
}

// --------------------------------------------------------------- importar

/** Lee y valida el zip sin tocar la base de datos. */
export async function readBackup(file: Blob): Promise<{ manifest: BackupManifest; files: Unzipped }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const files = await new Promise<Unzipped>((resolve, reject) => {
    unzip(bytes, (err, data) => (err ? reject(err) : resolve(data)));
  });
  const raw = files['armario.json'];
  if (!raw) throw new Error('El zip no contiene armario.json: no es una copia de Armario.');

  const manifest = JSON.parse(new TextDecoder().decode(raw)) as Partial<BackupManifest>;
  if (manifest.app !== 'armario' || typeof manifest.version !== 'number') {
    throw new Error('El fichero no es una copia de Armario.');
  }
  if (manifest.version > BACKUP_VERSION) {
    throw new Error(`La copia es de una versión más nueva de la app (formato ${manifest.version}).`);
  }
  if (!Array.isArray(manifest.garments) || !Array.isArray(manifest.outfits) || !Array.isArray(manifest.wearLogs)) {
    throw new Error('La copia está incompleta o dañada.');
  }
  for (const g of manifest.garments) {
    for (const ref of [g.imageOriginal, g.imageCutout, g.thumbnail]) {
      if (ref && !files[ref.path]) throw new Error(`Falta la imagen ${ref.path} dentro del zip.`);
    }
  }
  return { manifest: manifest as BackupManifest, files };
}

export function summarize(manifest: BackupManifest): BackupSummary {
  return { garments: manifest.garments.length, outfits: manifest.outfits.length, wearLogs: manifest.wearLogs.length };
}

/**
 * Sustituye TODO el contenido local por el de la copia. Va en una sola
 * transacción: si algo falla a medias, no queda un armario a medio borrar.
 */
export async function restoreBackup({ manifest, files }: { manifest: BackupManifest; files: Unzipped }): Promise<BackupSummary> {
  const blobOf = (ref: ImageRef): Blob => {
    const bytes = files[ref.path];
    if (!bytes) throw new Error(`Falta ${ref.path}`);
    return new Blob([toArrayBuffer(bytes)], { type: ref.type });
  };

  const garments: Garment[] = manifest.garments.map((g) => ({
    ...g,
    imageOriginal: blobOf(g.imageOriginal),
    imageCutout: g.imageCutout ? blobOf(g.imageCutout) : null,
    thumbnail: blobOf(g.thumbnail),
  }));
  const outfits: Outfit[] = manifest.outfits.map((o) => ({
    ...o,
    collage: o.collage ? blobOf(o.collage) : null,
  }));

  await db.transaction('rw', db.garments, db.outfits, db.wearLogs, async () => {
    await Promise.all([db.garments.clear(), db.outfits.clear(), db.wearLogs.clear()]);
    await db.garments.bulkAdd(garments);
    await db.outfits.bulkAdd(outfits);
    await db.wearLogs.bulkAdd(manifest.wearLogs);
  });

  return summarize(manifest);
}

/** Blob no acepta vistas sobre SharedArrayBuffer en los tipos; se copia el tramo exacto. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
