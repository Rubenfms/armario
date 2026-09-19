import Dexie, { type EntityTable } from 'dexie';
import type { Garment, Outfit, WearLog } from './types';

/**
 * Única instancia de la base de datos. Los índices son los de PLAN.md §2;
 * los campos que no se listan aquí se guardan igual, solo que no se puede
 * consultar por ellos. `archived` es booleano: Dexie lo indexa sin problema.
 *
 * Cada cambio de esquema es una nueva llamada a `.version(n)`; nunca se edita
 * una versión ya publicada, o los dispositivos con datos no podrán abrir la
 * base. Las migraciones con datos van en `.upgrade()` de la versión nueva.
 */
export const db = new Dexie('armario') as Dexie & {
  garments: EntityTable<Garment, 'id'>;
  outfits: EntityTable<Outfit, 'id'>;
  wearLogs: EntityTable<WearLog, 'id'>;
};

db.version(1).stores({
  garments: 'id, category, archived, *tags',
  outfits: 'id, *tags',
  wearLogs: 'id, date, *garmentIds',
});
