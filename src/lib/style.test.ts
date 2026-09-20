import { describe, expect, it } from 'vitest';
import type { Category, Garment } from '../db/types';
import { bestPartners, formalityOf, hueRelation, scoreOutfit, toLch, verdictFor } from './style';

let n = 0;
function garment(category: Category, colorHex: string, overrides: Partial<Garment> = {}): Garment {
  n += 1;
  return {
    id: `${category}-${n}`,
    name: `${category} ${n}`,
    category,
    seasons: [],
    colorHex,
    colorName: '',
    tags: [],
    imageOriginal: new Blob(),
    imageCutout: null,
    thumbnail: new Blob(),
    useCutout: true,
    archived: false,
    createdAt: n,
    ...overrides,
  };
}

const WHITE = '#f4f4f2';
const BLACK = '#161616';
const NAVY = '#1c2a4d';
const RED = '#c8102e';
const GREEN = '#3a9d4a';
const ORANGE = '#e8721c';
const BLUE = '#2a5ec9';
const LIGHT_BLUE = '#8fb8de';
const YELLOW = '#f2c500';
const PURPLE = '#6b3fa0';

const part = (score: ReturnType<typeof scoreOutfit>, key: string) => score.parts.find((p) => p.key === key)!;

describe('toLch / hueRelation', () => {
  it('detecta neutros por croma bajo', () => {
    expect(toLch(WHITE)!.C).toBeLessThan(18);
    expect(toLch(BLACK)!.C).toBeLessThan(18);
    expect(toLch(RED)!.C).toBeGreaterThan(45);
  });

  it('rechaza hex inválidos', () => {
    expect(toLch('')).toBeNull();
    expect(toLch('rojo')).toBeNull();
  });

  it('clasifica relaciones de tono', () => {
    expect(hueRelation(10, 20)).toBe('monocromo');
    expect(hueRelation(10, 50)).toBe('analogos');
    expect(hueRelation(10, 190)).toBe('complementarios');
    expect(hueRelation(0, 120)).toBe('triadicos');
    expect(hueRelation(0, 80)).toBe('choque');
    expect(hueRelation(355, 5)).toBe('monocromo'); // cruza el 0
    expect(hueRelation(350, 30)).toBe('analogos');
  });
});

describe('armonía', () => {
  it('un acento vivo sobre neutros es la nota máxima', () => {
    const s = scoreOutfit([garment('superior', RED), garment('inferior', BLACK), garment('calzado', WHITE)], 'verano');
    expect(part(s, 'armonia').points).toBe(35);
  });

  it('neutros con tonos apagados (marino, marrón) son base sólida', () => {
    const s = scoreOutfit([garment('superior', WHITE), garment('inferior', NAVY), garment('calzado', '#6b4423')], 'verano');
    expect(part(s, 'armonia').points).toBe(32);
    expect(part(s, 'armonia').note).toMatch(/apagados/);
  });

  it('todo neutro puntúa alto pero no máximo', () => {
    const s = scoreOutfit([garment('superior', WHITE), garment('inferior', BLACK), garment('calzado', '#8a8a8a')], 'verano');
    expect(part(s, 'armonia').points).toBe(27);
  });

  it('dos colores que chocan penalizan claramente', () => {
    const clash = scoreOutfit([garment('superior', RED), garment('inferior', PURPLE), garment('calzado', BLACK)], 'verano');
    const comp = scoreOutfit([garment('superior', ORANGE), garment('inferior', BLUE), garment('calzado', BLACK)], 'verano');
    expect(part(clash, 'armonia').points).toBeLessThan(part(comp, 'armonia').points - 10);
  });

  it('cuatro colores vivos restan más que tres', () => {
    const three = scoreOutfit([garment('superior', RED), garment('inferior', BLUE), garment('calzado', GREEN)], 'verano');
    const four = scoreOutfit([garment('superior', RED), garment('inferior', BLUE), garment('calzado', GREEN), garment('abrigo', YELLOW)], 'verano');
    expect(part(four, 'armonia').points).toBeLessThan(part(three, 'armonia').points);
  });

  it('sin colores detectados da nota provisional', () => {
    const s = scoreOutfit([garment('superior', ''), garment('inferior', ''), garment('calzado', '')], 'verano');
    expect(part(s, 'armonia').note).toMatch(/provisional/);
  });
});

describe('contraste', () => {
  it('claro arriba y oscuro abajo: máximo', () => {
    const s = scoreOutfit([garment('superior', WHITE), garment('inferior', BLACK)], 'verano');
    expect(part(s, 'contraste').points).toBe(20);
  });

  it('misma luminosidad y distinto color: se funden', () => {
    // azul L42 y rojo L43: misma luminosidad
    const s = scoreOutfit([garment('superior', BLUE), garment('inferior', RED)], 'verano');
    expect(part(s, 'contraste').points).toBeLessThanOrEqual(8);
  });

  it('monocromo total puntúa por encima de fundirse', () => {
    const s = scoreOutfit([garment('superior', BLUE), garment('inferior', BLUE)], 'verano');
    expect(part(s, 'contraste').points).toBe(14);
  });
});

describe('saturación', () => {
  it('una prenda viva es el punto focal; tres son ruido', () => {
    const one = scoreOutfit([garment('superior', RED), garment('inferior', NAVY), garment('calzado', BLACK)], 'verano');
    const three = scoreOutfit([garment('superior', RED), garment('inferior', GREEN), garment('calzado', YELLOW)], 'verano');
    expect(part(one, 'saturacion').points).toBe(15);
    expect(part(three, 'saturacion').points).toBeLessThan(6);
  });
});

describe('temporada', () => {
  it('penaliza prendas fuera de temporada', () => {
    const ok = scoreOutfit([garment('superior', WHITE, { seasons: ['verano'] }), garment('inferior', BLACK)], 'verano');
    const off = scoreOutfit([garment('superior', WHITE, { seasons: ['invierno'] }), garment('inferior', BLACK)], 'verano');
    expect(part(ok, 'temporada').points).toBe(15);
    expect(part(off, 'temporada').points).toBe(7);
    expect(part(off, 'temporada').note).toContain('no es de esta temporada');
  });
});

describe('estilo', () => {
  it('deriva la formalidad de las etiquetas', () => {
    expect(formalityOf(['Oficina'])).toBe('formal');
    expect(formalityOf(['playa'])).toBe('casual');
    expect(formalityOf(['oficina', 'playa'])).toBeNull();
    expect(formalityOf(['rojo'])).toBeNull();
  });

  it('mezclar formal y casual penaliza y nombra la prenda', () => {
    const s = scoreOutfit(
      [garment('superior', WHITE, { tags: ['oficina'], name: 'Camisa' }), garment('inferior', BLACK, { tags: ['oficina'] }), garment('calzado', BLACK, { tags: ['deporte'], name: 'Zapatillas' })],
      'verano',
    );
    expect(part(s, 'estilo').points).toBe(5);
    expect(part(s, 'estilo').note).toContain('Zapatillas');
  });

  it('todo coherente puntúa máximo', () => {
    const s = scoreOutfit([garment('superior', WHITE, { tags: ['oficina'] }), garment('inferior', BLACK, { tags: ['oficina'] })], 'verano');
    expect(part(s, 'estilo').points).toBe(15);
  });
});

describe('total y veredicto', () => {
  it('un clásico bien hecho supera 85 y un desastre no llega a 55', () => {
    const classic = scoreOutfit(
      [
        garment('superior', WHITE, { tags: ['oficina'], seasons: ['verano'] }),
        garment('inferior', NAVY, { tags: ['oficina'] }),
        garment('calzado', '#6b4423', { tags: ['oficina'] }),
      ],
      'verano',
    );
    const mess = scoreOutfit(
      [
        garment('superior', RED, { tags: ['boda'], seasons: ['invierno'] }),
        garment('inferior', PURPLE, { tags: ['gym'], seasons: ['invierno'] }),
        garment('calzado', YELLOW, { tags: ['playa'] }),
        garment('abrigo', GREEN),
      ],
      'verano',
    );
    expect(classic.total).toBeGreaterThanOrEqual(85);
    expect(classic.verdict).toBe('Redondo');
    expect(mess.total).toBeLessThan(55);
    expect(mess.verdict).toBe('Chirría');

  });

  it('el veredicto sigue las bandas', () => {
    expect(verdictFor(90)).toBe('Redondo');
    expect(verdictFor(70)).toBe('Funciona');
    expect(verdictFor(60)).toBe('Pasable');
    expect(verdictFor(30)).toBe('Chirría');
  });

  it('azul con morado son vecinos; azul claro (apagado) con azul es un acento', () => {
    const analog = scoreOutfit([garment('superior', BLUE), garment('inferior', PURPLE)], 'verano');
    expect(part(analog, 'armonia').note).toMatch(/vecinos/);
    const accent = scoreOutfit([garment('superior', LIGHT_BLUE), garment('inferior', BLUE)], 'verano');
    expect(part(accent, 'armonia').points).toBe(35);
  });
});

describe('bestPartners', () => {
  it('ordena las candidatas por nota, salta misma categoria, archivadas y sin color', () => {
    const top = garment('superior', RED, { name: 'Camiseta roja' });
    const candidates = [
      garment('inferior', PURPLE, { name: 'Pantalon morado' }),
      garment('inferior', BLACK, { name: 'Pantalon negro' }),
      garment('inferior', NAVY, { name: 'Vaqueros' }),
      garment('superior', WHITE, { name: 'Otra camiseta' }),
      garment('calzado', WHITE, { name: 'Archivadas', archived: true }),
      garment('calzado', '', { name: 'Sin color' }),
      garment('calzado', BLACK, { name: 'Zapatos negros' }),
    ];
    const partners = bestPartners(top, candidates, 'verano');
    const names = partners.map((p) => p.garment.name);
    expect(names).toHaveLength(3);
    expect(names).not.toContain('Otra camiseta');
    expect(names).not.toContain('Archivadas');
    expect(names).not.toContain('Sin color');
    expect(names).not.toContain('Pantalon morado'); // rojo + morado chocan: la peor
    expect(partners[0]!.score.total).toBeGreaterThanOrEqual(partners[2]!.score.total);
  });

  it('sin color en la prenda no propone nada', () => {
    expect(bestPartners(garment('superior', ''), [garment('inferior', BLACK)], 'verano')).toEqual([]);
  });
});
