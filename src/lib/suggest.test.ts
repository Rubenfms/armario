import { describe, expect, it } from 'vitest';
import type { Category, Garment, Outfit, Season, WearLog } from '../db/types';
import { generateBest, generateOutfit, seasonForDate, suggest, toDateKey, usableOutfits, wornRecently } from './suggest';

// --------------------------------------------------------------- fixtures

let counter = 0;
function garment(category: Category, overrides: Partial<Garment> = {}): Garment {
  counter += 1;
  return {
    id: overrides.id ?? `${category}-${counter}`,
    name: `${category} ${counter}`,
    category,
    seasons: [],
    colorHex: '',
    colorName: '',
    tags: [],
    imageOriginal: new Blob(),
    imageCutout: null,
    thumbnail: new Blob(),
    useCutout: true,
    archived: false,
    createdAt: counter,
    ...overrides,
  };
}

function outfit(garmentIds: string[], overrides: Partial<Outfit> = {}): Outfit {
  counter += 1;
  return { id: `outfit-${counter}`, name: `Outfit ${counter}`, garmentIds, tags: [], collage: null, createdAt: counter, ...overrides };
}

function log(date: string, garmentIds: string[]): WearLog {
  counter += 1;
  return { id: `log-${counter}`, date, garmentIds, outfitId: null, source: 'manual' };
}

/** Generador determinista: devuelve la secuencia dada en bucle. */
function sequence(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length] ?? 0;
    i += 1;
    return v;
  };
}

const WINTER = new Date(2026, 0, 15); // 15 de enero
const SUMMER = new Date(2026, 6, 15); // 15 de julio

function basicWardrobe(seasons: Season[] = []): Garment[] {
  return [
    garment('superior', { id: 'top', seasons }),
    garment('inferior', { id: 'bottom', seasons }),
    garment('calzado', { id: 'shoes', seasons }),
  ];
}

// --------------------------------------------------------------- temporada

describe('seasonForDate', () => {
  it('asigna la temporada por mes (hemisferio norte)', () => {
    expect(seasonForDate(new Date(2026, 0, 1))).toBe('invierno');
    expect(seasonForDate(new Date(2026, 1, 28))).toBe('invierno');
    expect(seasonForDate(new Date(2026, 2, 1))).toBe('primavera');
    expect(seasonForDate(new Date(2026, 5, 30))).toBe('verano');
    expect(seasonForDate(new Date(2026, 8, 1))).toBe('otono');
    expect(seasonForDate(new Date(2026, 11, 25))).toBe('invierno');
  });
});

describe('toDateKey / wornRecently', () => {
  it('usa fecha local con ceros', () => {
    expect(toDateKey(new Date(2026, 8, 5))).toBe('2026-09-05');
  });

  it('cuenta los últimos 7 días, hoy incluido, y no más', () => {
    const today = new Date(2026, 8, 20);
    const worn = wornRecently(
      [log('2026-09-20', ['a']), log('2026-09-14', ['b']), log('2026-09-13', ['c']), log('2026-09-21', ['d'])],
      today,
    );
    expect(worn.has('a')).toBe(true);
    expect(worn.has('b')).toBe(true); // hace 6 días: dentro
    expect(worn.has('c')).toBe(false); // hace 7 días: fuera
    expect(worn.has('d')).toBe(false); // futuro: se ignora
  });
});

// --------------------------------------------------------------- generación

describe('generateOutfit', () => {
  it('respeta la temporada: no elige prendas de otra estación', () => {
    const wardrobe = [
      ...basicWardrobe(['invierno']),
      garment('superior', { id: 'top-verano', seasons: ['verano'] }),
      garment('inferior', { id: 'bottom-verano', seasons: ['verano'] }),
    ];
    for (let i = 0; i < 20; i += 1) {
      const result = generateOutfit(wardrobe, 'invierno', new Set(), Math.random);
      expect(result).not.toBeNull();
      expect(result?.relaxed).toBe('ninguna');
      const ids = result?.garments.map((g) => g.id) ?? [];
      expect(ids).not.toContain('top-verano');
      expect(ids).not.toContain('bottom-verano');
    }
  });

  it('las prendas sin temporada valen todo el año', () => {
    const result = generateOutfit(basicWardrobe(), 'verano', new Set());
    expect(result?.garments.map((g) => g.id).sort()).toEqual(['bottom', 'shoes', 'top']);
  });

  it('respeta la no repetición: evita lo puesto recientemente', () => {
    const wardrobe = [...basicWardrobe(), garment('superior', { id: 'top-2' })];
    for (let i = 0; i < 20; i += 1) {
      const result = generateOutfit(wardrobe, 'verano', new Set(['top']));
      expect(result?.relaxed).toBe('ninguna');
      expect(result?.garments.map((g) => g.id)).toContain('top-2');
      expect(result?.garments.map((g) => g.id)).not.toContain('top');
    }
  });

  it('excluye las archivadas aunque sea lo único que hay', () => {
    const wardrobe = [...basicWardrobe(), garment('superior', { id: 'top-arch', archived: true })];
    const result = generateOutfit(wardrobe, 'verano', new Set(['top']));
    expect(result?.garments.map((g) => g.id)).not.toContain('top-arch');
  });

  it('con armario pequeño relaja primero la repetición', () => {
    const result = generateOutfit(basicWardrobe(), 'verano', new Set(['top', 'bottom', 'shoes']));
    expect(result?.relaxed).toBe('repeticion');
    expect(result?.garments).toHaveLength(3);
  });

  it('y después la temporada', () => {
    const result = generateOutfit(basicWardrobe(['verano']), 'invierno', new Set());
    expect(result?.relaxed).toBe('temporada');
    expect(result?.garments).toHaveLength(3);
  });

  it('devuelve null si falta una categoría obligatoria', () => {
    const result = generateOutfit([garment('superior'), garment('inferior')], 'verano', new Set());
    expect(result).toBeNull();
  });

  it('añade abrigo en temporadas frías si lo hay, y no en las cálidas', () => {
    const wardrobe = [...basicWardrobe(), garment('abrigo', { id: 'coat' })];
    expect(generateOutfit(wardrobe, 'invierno', new Set())?.garments.map((g) => g.id)).toContain('coat');
    expect(generateOutfit(wardrobe, 'otono', new Set())?.garments.map((g) => g.id)).toContain('coat');
    expect(generateOutfit(wardrobe, 'verano', new Set())?.garments.map((g) => g.id)).not.toContain('coat');
    // Sin abrigo en el armario, el invierno no bloquea la generación.
    expect(generateOutfit(basicWardrobe(), 'invierno', new Set())?.garments).toHaveLength(3);
  });
});

describe('generateBest', () => {
  it('evita la combinación que peor puntúa cuando hay alternativas', () => {
    const wardrobe = [
      garment('superior', { id: 'top-rojo', colorHex: '#c8102e' }),
      garment('superior', { id: 'top-blanco', colorHex: '#f4f4f2' }),
      garment('inferior', { id: 'bottom-morado', colorHex: '#6b3fa0' }),
      garment('inferior', { id: 'bottom-marino', colorHex: '#1c2a4d' }),
      garment('calzado', { id: 'shoes', colorHex: '#161616' }),
    ];
    for (let i = 0; i < 30; i += 1) {
      const result = generateBest(wardrobe, 'verano', new Set());
      const ids = result?.garments.map((g) => g.id) ?? [];
      // rojo + morado chocan: es la peor de las cuatro y nunca debe salir.
      expect(ids.includes('top-rojo') && ids.includes('bottom-morado')).toBe(false);
      expect(result?.score.total).toBeGreaterThan(0);
    }
  });

  it('devuelve null si no hay combinación posible', () => {
    expect(generateBest([garment('superior')], 'verano', new Set())).toBeNull();
  });

  it('las sugerencias llevan puntuación, guardadas y nuevas', () => {
    const wardrobe = basicWardrobe();
    const saved = outfit(['top', 'bottom', 'shoes']);
    const a = suggest({ garments: wardrobe, outfits: [saved], wearLogs: [], today: SUMMER, random: sequence([0.1, 0]) });
    const b = suggest({ garments: wardrobe, outfits: [], wearLogs: [], today: SUMMER });
    expect(a?.score.parts).toHaveLength(5);
    expect(b?.score.verdict).toBeTruthy();
  });
});

// --------------------------------------------------------------- sugerencia

describe('usableOutfits', () => {
  it('descarta outfits con prendas borradas o archivadas', () => {
    const wardrobe = [...basicWardrobe(), garment('superior', { id: 'top-arch', archived: true })];
    const ok = outfit(['top', 'bottom']);
    const missing = outfit(['top', 'nope']);
    const archived = outfit(['top-arch', 'bottom']);
    expect(usableOutfits([ok, missing, archived], wardrobe)).toEqual([ok]);
  });
});

describe('suggest', () => {
  it('devuelve null con el armario vacío', () => {
    expect(suggest({ garments: [], outfits: [], wearLogs: [], today: SUMMER })).toBeNull();
  });

  it('con random < 0.5 elige un outfit guardado; con >= 0.5 genera uno nuevo', () => {
    const wardrobe = basicWardrobe();
    const saved = outfit(['top', 'bottom', 'shoes']);
    const input = { garments: wardrobe, outfits: [saved], wearLogs: [], today: SUMMER };

    const a = suggest({ ...input, random: sequence([0.1, 0]) });
    expect(a?.kind).toBe('guardado');
    if (a?.kind === 'guardado') expect(a.outfit.id).toBe(saved.id);

    const b = suggest({ ...input, random: sequence([0.9, 0]) });
    expect(b?.kind).toBe('nuevo');
  });

  it('sin outfits guardados siempre genera', () => {
    const result = suggest({ garments: basicWardrobe(), outfits: [], wearLogs: [], today: SUMMER, random: sequence([0.1, 0]) });
    expect(result?.kind).toBe('nuevo');
  });

  it('si no puede generar, cae en un guardado', () => {
    const wardrobe = [garment('superior', { id: 'top' }), garment('inferior', { id: 'bottom' })];
    const saved = outfit(['top', 'bottom']);
    const result = suggest({ garments: wardrobe, outfits: [saved], wearLogs: [], today: SUMMER, random: sequence([0.9, 0]) });
    expect(result?.kind).toBe('guardado');
  });

  it('marca la relajación cuando todo se ha llevado esta semana', () => {
    const wardrobe = basicWardrobe();
    const result = suggest({
      garments: wardrobe,
      outfits: [],
      wearLogs: [log(toDateKey(WINTER), ['top', 'bottom', 'shoes'])],
      today: WINTER,
    });
    expect(result?.kind).toBe('nuevo');
    if (result?.kind === 'nuevo') expect(result.relaxed).toBe('repeticion');
  });

  it('intenta no repetir la sugerencia anterior si hay alternativa', () => {
    const wardrobe = [...basicWardrobe(), garment('superior', { id: 'top-2' })];
    for (let i = 0; i < 20; i += 1) {
      const result = suggest({ garments: wardrobe, outfits: [], wearLogs: [], today: SUMMER, avoid: ['top', 'bottom', 'shoes'] });
      expect(result?.garments.map((g) => g.id)).toContain('top-2');
    }
  });
});
