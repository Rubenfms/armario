/**
 * Cuota de almacenamiento y persistencia. Todo lo de la app vive en
 * IndexedDB, y el navegador puede vaciarla bajo presion de disco si no se le
 * pide que la conserve.
 */

export interface StorageInfo {
  usage: number;
  quota: number;
  /** Fraccion de cuota usada, 0..1. */
  ratio: number;
  persisted: boolean | null; // null si el navegador no lo expone
}

/** A partir de aqui se avisa. */
export const STORAGE_WARN_RATIO = 0.8;

export async function getStorageInfo(): Promise<StorageInfo | null> {
  if (!('storage' in navigator) || typeof navigator.storage.estimate !== 'function') return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  const persisted = typeof navigator.storage.persisted === 'function' ? await navigator.storage.persisted() : null;
  return { usage, quota, ratio: quota > 0 ? usage / quota : 0, persisted };
}

/** Pide almacenamiento persistente; devuelve si se concedio. */
export async function requestPersistence(): Promise<boolean> {
  if (!('storage' in navigator) || typeof navigator.storage.persist !== 'function') return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
