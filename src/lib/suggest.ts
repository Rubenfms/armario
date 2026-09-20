import type { Category, Garment, Outfit, Season, WearLog } from '../db/types';
import { scoreOutfit, type StyleScore } from './style';

/**
 * Motor de sugerencia diaria. Sin DOM ni base de datos: recibe las tablas ya
 * cargadas y un generador aleatorio inyectable, para que los tests sean
 * deterministas.
 */

/** Qué regla hubo que relajar para poder generar algo. */
export type Relaxed = 'ninguna' | 'repeticion' | 'temporada';

export type Suggestion =
  | { kind: 'guardado'; outfit: Outfit; garments: Garment[]; score: StyleScore }
  | { kind: 'nuevo'; garments: Garment[]; relaxed: Relaxed; score: StyleScore };

export interface SuggestInput {
  garments: Garment[];
  outfits: Outfit[];
  wearLogs: WearLog[];
  today: Date;
  random?: () => number;
  /** Ids de prendas de la sugerencia anterior, para no repetirla al pedir otra. */
  avoid?: string[];
}

/** Días que una prenda queda «descansando» tras ponérsela. */
export const REST_DAYS = 7;

/** Combinaciones que se generan antes de quedarse con las mejores. */
const CANDIDATES = 24;
/** Entre cuántas de las mejores se elige al azar, para no dar siempre la misma. */
const TOP = 3;

/** Categorías que toda combinación generada debe tener. */
const REQUIRED: readonly Category[] = ['superior', 'inferior', 'calzado'];

/**
 * Temporada por mes, hemisferio norte: dic–feb invierno, mar–may primavera,
 * jun–ago verano, sep–nov otoño. Sin equinoccios: nadie cambia de armario
 * el día 21.
 */
export function seasonForDate(date: Date): Season {
  const month = date.getMonth();
  if (month === 11 || month <= 1) return 'invierno';
  if (month <= 4) return 'primavera';
  if (month <= 7) return 'verano';
  return 'otono';
}

/** Abrigo solo en las temporadas frías. */
export function wantsCoat(season: Season): boolean {
  return season === 'otono' || season === 'invierno';
}

/** YYYY-MM-DD en hora local, que es la que cuenta para «hoy». */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Prendas registradas en los últimos `days` días (hoy incluido). */
export function wornRecently(wearLogs: WearLog[], today: Date, days = REST_DAYS): Set<string> {
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  const fromKey = toDateKey(from);
  const todayKey = toDateKey(today);
  const ids = new Set<string>();
  for (const log of wearLogs) {
    if (log.date >= fromKey && log.date <= todayKey) {
      for (const id of log.garmentIds) ids.add(id);
    }
  }
  return ids;
}

function fitsSeason(garment: Garment, season: Season): boolean {
  return garment.seasons.length === 0 || garment.seasons.includes(season);
}

function pick<T>(items: T[], random: () => number): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

/**
 * Una prenda por categoría obligatoria (más abrigo si la temporada lo pide y
 * hay alguno), respetando temporada y descanso. Si con las reglas completas
 * falta alguna categoría obligatoria, se relaja primero el descanso y luego
 * la temporada; se devuelve qué se relajó. `null` si ni así hay prendas.
 *
 * `avoid` son las prendas de la sugerencia anterior: en cada categoría se
 * prefiere una distinta si la hay, para que «otra sugerencia» sea otra.
 */
export function generateOutfit(
  garments: Garment[],
  season: Season,
  recentlyWorn: Set<string>,
  random: () => number = Math.random,
  avoid: Set<string> = new Set(),
): { garments: Garment[]; relaxed: Relaxed } | null {
  const active = garments.filter((g) => !g.archived);
  const attempts: Array<{ relaxed: Relaxed; pool: Garment[] }> = [
    { relaxed: 'ninguna', pool: active.filter((g) => fitsSeason(g, season) && !recentlyWorn.has(g.id)) },
    { relaxed: 'repeticion', pool: active.filter((g) => fitsSeason(g, season)) },
    { relaxed: 'temporada', pool: active },
  ];

  const pickFresh = (candidates: Garment[]) => {
    const fresh = candidates.filter((g) => !avoid.has(g.id));
    return pick(fresh.length > 0 ? fresh : candidates, random);
  };

  for (const { relaxed, pool } of attempts) {
    const chosen: Garment[] = [];
    let complete = true;
    for (const category of REQUIRED) {
      const garment = pickFresh(pool.filter((g) => g.category === category));
      if (!garment) {
        complete = false;
        break;
      }
      chosen.push(garment);
    }
    if (!complete) continue;

    if (wantsCoat(season)) {
      const coat = pickFresh(pool.filter((g) => g.category === 'abrigo'));
      if (coat) chosen.push(coat);
    }
    return { garments: chosen, relaxed };
  }
  return null;
}

/**
 * Genera varias combinaciones válidas, las puntúa con el motor de estilo y
 * devuelve una de las mejores. Todas comparten el nivel de relajación, que
 * depende del armario y no del azar.
 */
export function generateBest(
  garments: Garment[],
  season: Season,
  recentlyWorn: Set<string>,
  random: () => number = Math.random,
  avoid: Set<string> = new Set(),
): { garments: Garment[]; relaxed: Relaxed; score: StyleScore } | null {
  const unique = new Map<string, { garments: Garment[]; relaxed: Relaxed }>();
  for (let i = 0; i < CANDIDATES; i += 1) {
    const candidate = generateOutfit(garments, season, recentlyWorn, random, avoid);
    if (!candidate) return null;
    unique.set(keyOf(candidate.garments.map((g) => g.id)), candidate);
  }
  const scored = [...unique.values()]
    .map((c) => ({ ...c, score: scoreOutfit(c.garments, season) }))
    .sort((a, b) => b.score.total - a.score.total);
  return pick(scored.slice(0, TOP), random) ?? null;
}

/** Outfits guardados cuyas prendas siguen todas existiendo y sin archivar. */
export function usableOutfits(outfits: Outfit[], garments: Garment[]): Outfit[] {
  const byId = new Map(garments.map((g) => [g.id, g]));
  return outfits.filter(
    (o) => o.garmentIds.length > 0 && o.garmentIds.every((id) => byId.get(id) !== undefined && !byId.get(id)?.archived),
  );
}

/**
 * 50 % un outfit guardado al azar, 50 % una combinación nueva. Si una de las
 * dos vías no da nada, se usa la otra. `null` solo con el armario vacío.
 * Con `avoid` (la sugerencia anterior) se evita repetirla siempre que el
 * armario dé para otra cosa.
 */
export function suggest(input: SuggestInput): Suggestion | null {
  const random = input.random ?? Math.random;
  const season = seasonForDate(input.today);
  const recentlyWorn = wornRecently(input.wearLogs, input.today);
  const byId = new Map(input.garments.map((g) => [g.id, g]));
  const avoid = new Set(input.avoid ?? []);
  const avoidKey = keyOf(input.avoid ?? []);

  const saved = usableOutfits(input.outfits, input.garments);
  const freshSaved = saved.filter((o) => keyOf(o.garmentIds) !== avoidKey);
  const pickSaved = (): Suggestion | null => {
    const outfit = pick(freshSaved.length > 0 ? freshSaved : saved, random);
    if (!outfit) return null;
    const garments = outfit.garmentIds.map((id) => byId.get(id)).filter(isGarment);
    return { kind: 'guardado', outfit, garments, score: scoreOutfit(garments, season) };
  };
  const pickNew = (): Suggestion | null => {
    const generated = generateBest(input.garments, season, recentlyWorn, random, avoid);
    return generated ? { kind: 'nuevo', ...generated } : null;
  };

  const preferSaved = random() < 0.5;
  return (preferSaved ? pickSaved() ?? pickNew() : pickNew() ?? pickSaved()) ?? null;
}

function keyOf(ids: string[]): string {
  return [...ids].sort().join(',');
}

function isGarment(g: Garment | undefined): g is Garment {
  return g !== undefined;
}
