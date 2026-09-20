import type { Garment, Season } from '../db/types';
import { hexToRgb, rgbToLab } from './color';

/**
 * Puntuación de estilo de un conjunto de prendas: reglas fijas de teoría del
 * color y coherencia, en el dispositivo. Determinista: las mismas prendas
 * dan siempre la misma nota, y cada punto viene con su explicación.
 *
 * Escala 0–100 repartida así:
 *   armonía de color 35 · contraste 20 · saturación 15 · temporada 15 · estilo 15
 */

export interface ScorePart {
  key: 'armonia' | 'contraste' | 'saturacion' | 'temporada' | 'estilo';
  label: string;
  points: number;
  max: number;
  note: string;
}

export interface StyleScore {
  total: number;
  parts: ScorePart[];
  verdict: string;
}

/** Color de una prenda en LCh (luminosidad, croma, tono en grados). */
interface Lch {
  L: number;
  C: number;
  h: number;
}

/**
 * Bandas de croma (calibradas con la paleta de color.ts):
 *   < 18  neutro: blancos, crudos, grises, negro
 *   18–37 apagado: marino, vaquero, marrón, beige, oliva, granate, verde oscuro
 *   ≥ 38  vivo: rojo, naranja, amarillo, verde, azul, morado, rosa, camel
 * Los apagados son los «básicos de fondo de armario»: combinan con casi todo
 * y no cuentan como color que compita. Los vivos, sí.
 */
const NEUTRAL_CHROMA = 18;
const STRONG_CHROMA = 38;
/** Croma a partir del cual una prenda «grita» (para el equilibrio de saturación). */
const VIVID_CHROMA = 45;

const FORMAL_TAGS = ['oficina', 'trabajo', 'formal', 'elegante', 'boda', 'cena', 'evento', 'reunión', 'reunion', 'traje'];
const CASUAL_TAGS = ['casa', 'casual', 'deporte', 'gym', 'gimnasio', 'playa', 'cómodo', 'comodo', 'paseo', 'finde', 'montaña', 'montana'];

// --------------------------------------------------------------- API

export function scoreOutfit(garments: Garment[], season: Season): StyleScore {
  const parts = [
    scoreHarmony(garments),
    scoreContrast(garments),
    scoreSaturation(garments),
    scoreSeason(garments, season),
    scoreStyle(garments),
  ];
  const total = Math.max(0, Math.min(100, Math.round(parts.reduce((sum, p) => sum + p.points, 0))));
  return { total, parts, verdict: verdictFor(total) };
}

export function verdictFor(total: number): string {
  if (total >= 85) return 'Redondo';
  if (total >= 70) return 'Funciona';
  if (total >= 55) return 'Pasable';
  return 'Chirría';
}

// --------------------------------------------------------------- color

export function toLch(hex: string): Lch | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const [L, a, b] = rgbToLab(hexToRgb(hex));
  const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { L, C: Math.hypot(a, b), h };
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

type Relation = 'monocromo' | 'analogos' | 'complementarios' | 'triadicos' | 'choque';

/** Relación entre dos tonos según su distancia en el círculo cromático. */
export function hueRelation(a: number, b: number): Relation {
  const d = hueDistance(a, b);
  if (d <= 15) return 'monocromo';
  if (d <= 50) return 'analogos';
  if (d >= 135) return 'complementarios';
  if (d >= 100) return 'triadicos';
  return 'choque';
}

const RELATION_POINTS: Record<Relation, { points: number; note: string }> = {
  complementarios: { points: 31, note: 'Dos colores complementarios: contraste con intención.' },
  analogos: { points: 30, note: 'Colores vecinos en el círculo cromático: combinan sin esfuerzo.' },
  monocromo: { points: 28, note: 'Dos tonos del mismo color: elegante, cuidado con que no quede plano.' },
  triadicos: { points: 24, note: 'Tríada de colores: atrevido, funciona si uno domina.' },
  choque: { points: 12, note: 'Dos colores que chocan: ni vecinos ni opuestos.' },
};

function scoreHarmony(garments: Garment[]): ScorePart {
  const max = 35;
  const colors = garments.map((g) => toLch(g.colorHex)).filter((c): c is Lch => c !== null);
  const label = 'Armonía de color';

  if (colors.length < 2) {
    return { key: 'armonia', label, points: 22, max, note: 'Faltan colores por detectar: nota provisional.' };
  }

  const muted = colors.filter((c) => c.C >= NEUTRAL_CHROMA && c.C < STRONG_CHROMA);
  const strong = colors.filter((c) => c.C >= STRONG_CHROMA);

  if (strong.length === 0) {
    if (muted.length === 0) {
      return { key: 'armonia', label, points: 27, max, note: 'Todo neutro: seguro, aunque algo plano.' };
    }
    const clash = worstRelation(muted) === 'choque';
    return {
      key: 'armonia',
      label,
      points: clash ? 29 : 32,
      max,
      note: clash ? 'Neutros y tonos apagados; dos de ellos no son vecinos, pero al ser apagados conviven.' : 'Neutros y tonos apagados: base sólida, difícil de estropear.',
    };
  }
  if (strong.length === 1) {
    return { key: 'armonia', label, points: 35, max, note: 'Un color de acento sobre neutros: la fórmula que nunca falla.' };
  }

  // Con varios vivos manda la peor pareja: un choque no lo arregla otra
  // pareja que sí combine.
  const worst = worstRelation(strong);
  let points = RELATION_POINTS[worst].points;
  let note = RELATION_POINTS[worst].note;
  if (strong.length > 3) {
    points -= 4 * (strong.length - 3);
    note += ` ${strong.length} colores vivos a la vez: demasiados.`;
  } else if (strong.length === 3) {
    points -= 3;
    note += ' Tres colores vivos: en el límite.';
  }
  return { key: 'armonia', label, points: Math.max(0, points), max, note };
}

function worstRelation(colors: Lch[]): Relation {
  let worst: Relation = 'monocromo';
  let worstPoints = Infinity;
  for (let i = 0; i < colors.length; i += 1) {
    for (let j = i + 1; j < colors.length; j += 1) {
      const a = colors[i];
      const b = colors[j];
      if (!a || !b) continue;
      const rel = hueRelation(a.h, b.h);
      if (RELATION_POINTS[rel].points < worstPoints) {
        worstPoints = RELATION_POINTS[rel].points;
        worst = rel;
      }
    }
  }
  return worst;
}

function scoreContrast(garments: Garment[]): ScorePart {
  const max = 20;
  const label = 'Contraste';
  const top = garments.find((g) => g.category === 'superior');
  const bottom = garments.find((g) => g.category === 'inferior');
  const a = top ? toLch(top.colorHex) : null;
  const b = bottom ? toLch(bottom.colorHex) : null;
  if (!a || !b) {
    return { key: 'contraste', label, points: 12, max, note: 'Sin superior e inferior con color no se puede medir.' };
  }
  const dL = Math.abs(a.L - b.L);
  const sameHue = a.C >= NEUTRAL_CHROMA && b.C >= NEUTRAL_CHROMA && hueRelation(a.h, b.h) === 'monocromo';
  if (dL >= 20) {
    return { key: 'contraste', label, points: 20, max, note: 'Arriba y abajo se distinguen bien: hay contraste de luz.' };
  }
  if (dL >= 10) {
    return { key: 'contraste', label, points: 15, max, note: 'Contraste suave entre arriba y abajo.' };
  }
  if (sameHue) {
    return { key: 'contraste', label, points: 14, max, note: 'Mismo color arriba y abajo: monocromo total, mejor con texturas distintas.' };
  }
  return { key: 'contraste', label, points: 8, max, note: 'Arriba y abajo con la misma luminosidad: se funden.' };
}

function scoreSaturation(garments: Garment[]): ScorePart {
  const max = 15;
  const label = 'Saturación';
  const vivid = garments.map((g) => toLch(g.colorHex)).filter((c): c is Lch => c !== null && c.C >= VIVID_CHROMA).length;
  if (vivid === 0) return { key: 'saturacion', label, points: 12, max, note: 'Sin colores estridentes: sobrio.' };
  if (vivid === 1) return { key: 'saturacion', label, points: 15, max, note: 'Una sola prenda muy saturada: es el punto focal.' };
  if (vivid === 2) return { key: 'saturacion', label, points: 9, max, note: 'Dos prendas muy saturadas compiten por la atención.' };
  return { key: 'saturacion', label, points: 4, max, note: `${vivid} prendas muy saturadas: demasiado ruido.` };
}

function scoreSeason(garments: Garment[], season: Season): ScorePart {
  const max = 15;
  const label = 'Temporada';
  const off = garments.filter((g) => g.seasons.length > 0 && !g.seasons.includes(season));
  if (off.length === 0) return { key: 'temporada', label, points: 15, max, note: 'Todo encaja con la temporada.' };
  if (off.length === 1) {
    return { key: 'temporada', label, points: 7, max, note: `«${off[0]?.name ?? ''}» no es de esta temporada.` };
  }
  return { key: 'temporada', label, points: 0, max, note: `${off.length} prendas fuera de temporada.` };
}

type Formality = 'formal' | 'casual' | null;

export function formalityOf(tags: string[]): Formality {
  const lower = tags.map((t) => t.toLowerCase());
  const formal = lower.some((t) => FORMAL_TAGS.includes(t));
  const casual = lower.some((t) => CASUAL_TAGS.includes(t));
  if (formal && !casual) return 'formal';
  if (casual && !formal) return 'casual';
  return null;
}

function scoreStyle(garments: Garment[]): ScorePart {
  const max = 15;
  const label = 'Estilo';
  const known = garments.map((g) => ({ g, f: formalityOf(g.tags) })).filter((x): x is { g: Garment; f: 'formal' | 'casual' } => x.f !== null);
  if (known.length === 0) {
    return { key: 'estilo', label, points: 12, max, note: 'Sin etiquetas de estilo: no hay nada que contradiga.' };
  }
  const formal = known.filter((x) => x.f === 'formal');
  const casual = known.filter((x) => x.f === 'casual');
  if (formal.length > 0 && casual.length > 0) {
    const odd = formal.length <= casual.length ? formal[0] : casual[0];
    return { key: 'estilo', label, points: 5, max, note: `Mezcla formal y casual: «${odd?.g.name ?? ''}» va por libre.` };
  }
  // Etiquetas compartidas entre prendas refuerzan que están pensadas juntas.
  const shared = sharedTags(garments);
  const note = shared.length > 0 ? `Estilo coherente (${formal.length > 0 ? 'formal' : 'casual'}); comparten «${shared[0]}».` : `Estilo coherente: todo ${formal.length > 0 ? 'formal' : 'casual'}.`;
  return { key: 'estilo', label, points: 15, max, note };
}

function sharedTags(garments: Garment[]): string[] {
  if (garments.length < 2) return [];
  const counts = new Map<string, number>();
  for (const g of garments) for (const t of new Set(g.tags)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n >= 2).map(([t]) => t);
}
