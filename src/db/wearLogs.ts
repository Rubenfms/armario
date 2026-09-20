import { db } from './db';
import type { WearLog } from './types';

export async function addWearLog(fields: Omit<WearLog, 'id'>): Promise<string> {
  const log: WearLog = { id: crypto.randomUUID(), ...fields };
  await db.wearLogs.add(log);
  return log.id;
}

/** Registros desde una fecha (YYYY-MM-DD) en adelante. */
export function wearLogsSince(dateKey: string): Promise<WearLog[]> {
  return db.wearLogs.where('date').aboveOrEqual(dateKey).toArray();
}
