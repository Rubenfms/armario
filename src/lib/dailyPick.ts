import type { Suggestion } from './suggest';

/**
 * La sugerencia del día se guarda para que abrir la app dos veces la misma
 * mañana no cambie de outfit. Solo ids: al restaurar se comprueba que las
 * prendas (y el outfit, si era guardado) sigan existiendo.
 */

const KEY = 'armario:pick';

export interface StoredPick {
  date: string;
  kind: Suggestion['kind'];
  outfitId: string | null;
  garmentIds: string[];
  relaxed: 'ninguna' | 'repeticion' | 'temporada';
}

export function loadPick(date: string): StoredPick | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const pick = JSON.parse(raw) as StoredPick;
    return pick.date === date ? pick : null;
  } catch {
    return null;
  }
}

export function savePick(date: string, suggestion: Suggestion): void {
  const pick: StoredPick = {
    date,
    kind: suggestion.kind,
    outfitId: suggestion.kind === 'guardado' ? suggestion.outfit.id : null,
    garmentIds: suggestion.garments.map((g) => g.id),
    relaxed: suggestion.kind === 'nuevo' ? suggestion.relaxed : 'ninguna',
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(pick));
  } catch {
    // Sin localStorage (modo privado estricto) simplemente no se recuerda.
  }
}
