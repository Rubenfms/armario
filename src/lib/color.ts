/**
 * Color dominante de una prenda recortada y su nombre aproximado.
 *
 * Sin dependencias ni DOM: recibe los píxeles ya leídos de un canvas, así que
 * corre igual en el worker que en un test.
 */

export interface DominantColor {
  hex: string;
  name: string;
}

type Rgb = readonly [number, number, number];
type Lab = readonly [number, number, number];

/**
 * Paleta fija con nombres en español. Los valores son representantes, no
 * definiciones: cada color extraído se asigna al más cercano en Lab.
 */
export const PALETTE: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'blanco', hex: '#f4f4f2' },
  { name: 'crudo', hex: '#ece3cc' },
  { name: 'beige', hex: '#d3bb95' },
  { name: 'camel', hex: '#b07a3c' },
  { name: 'marrón', hex: '#6b4423' },
  { name: 'gris claro', hex: '#c9c9c9' },
  { name: 'gris', hex: '#8a8a8a' },
  { name: 'gris oscuro', hex: '#4a4a4a' },
  { name: 'negro', hex: '#161616' },
  { name: 'rojo', hex: '#c8102e' },
  { name: 'granate', hex: '#6d1f2c' },
  { name: 'naranja', hex: '#e8721c' },
  { name: 'amarillo', hex: '#f2c500' },
  { name: 'mostaza', hex: '#c9a227' },
  { name: 'verde', hex: '#3a9d4a' },
  { name: 'verde oliva', hex: '#6b6b2a' },
  { name: 'verde oscuro', hex: '#1f4d2e' },
  { name: 'turquesa', hex: '#2bb3b1' },
  { name: 'azul claro', hex: '#8fb8de' },
  { name: 'vaquero', hex: '#4a6b9a' },
  { name: 'azul', hex: '#2a5ec9' },
  { name: 'azul marino', hex: '#1c2a4d' },
  { name: 'morado', hex: '#6b3fa0' },
  { name: 'rosa', hex: '#e88bb5' },
];

/** Píxeles con alfa por debajo de esto se consideran fondo (bordes suaves). */
const MIN_ALPHA = 200;
/** Cuántos píxeles como mucho entran en el k-means. */
const MAX_SAMPLES = 4000;
/** Croma en Lab por debajo del cual un color cuenta como gris. */
const GRAY_CHROMA = 12;
/** Peso mínimo de un grupo de color para preferirlo a un gris mayoritario. */
const MIN_COLOR_SHARE = 0.15;

/**
 * Devuelve `null` si la imagen no tiene píxeles opacos suficientes (recorte
 * vacío), para que el llamador no guarde un color inventado.
 */
export function dominantColor(rgba: Uint8ClampedArray, width: number, height: number): DominantColor | null {
  const samples = sampleOpaquePixels(rgba, width, height);
  if (samples.length < 20) return null;

  const clusters = kMeans(samples, 3, 12);
  if (clusters.length === 0) return null;

  // El grupo más poblado manda, salvo que sea gris y haya un color de verdad
  // con peso suficiente: una camisa blanca con logo sigue siendo blanca, pero
  // una de rayas gris/azul es azul.
  const byShare = [...clusters].sort((a, b) => b.share - a.share);
  const top = byShare[0];
  if (!top) return null;
  const alternative = byShare.find((c) => !isGray(c.lab) && c.share >= MIN_COLOR_SHARE);
  const chosen = isGray(top.lab) && alternative ? alternative : top;

  return { hex: rgbToHex(chosen.rgb), name: nearestName(chosen.lab) };
}

export function nearestName(lab: Lab): string {
  let best = PALETTE[0];
  let bestDist = Infinity;
  for (const entry of PALETTE) {
    const d = distance(lab, rgbToLab(hexToRgb(entry.hex)));
    if (d < bestDist) {
      bestDist = d;
      best = entry;
    }
  }
  return best?.name ?? '';
}

/** Nombre de paleta para un hex cualquiera (útil al editar a mano). */
export function nameForHex(hex: string): string {
  return nearestName(rgbToLab(hexToRgb(hex)));
}

// --------------------------------------------------------------- muestreo

function sampleOpaquePixels(rgba: Uint8ClampedArray, width: number, height: number): Lab[] {
  const total = width * height;
  // Paso uniforme para no pasar de MAX_SAMPLES aunque la imagen sea grande.
  const step = Math.max(1, Math.floor(total / MAX_SAMPLES));
  const out: Lab[] = [];
  for (let i = 0; i < total; i += step) {
    const o = i * 4;
    const a = rgba[o + 3] ?? 0;
    if (a < MIN_ALPHA) continue;
    out.push(rgbToLab([rgba[o] ?? 0, rgba[o + 1] ?? 0, rgba[o + 2] ?? 0]));
  }
  return out;
}

// --------------------------------------------------------------- k-means

interface Cluster {
  lab: Lab;
  rgb: Rgb;
  share: number;
}

function kMeans(points: Lab[], k: number, iterations: number): Cluster[] {
  if (points.length === 0) return [];
  k = Math.min(k, points.length);

  // Semillas: la primera al azar y las demás lo más lejos posible de las ya
  // elegidas (k-means++ simplificado). Evita que dos centros caigan juntos.
  const first = points[Math.floor(Math.random() * points.length)];
  if (!first) return [];
  const centers: Lab[] = [first];
  while (centers.length < k) {
    let farthest: Lab = first;
    let farthestDist = -1;
    for (const p of points) {
      const d = Math.min(...centers.map((c) => distance(p, c)));
      if (d > farthestDist) {
        farthestDist = d;
        farthest = p;
      }
    }
    centers.push(farthest);
  }

  const assignment = new Array<number>(points.length).fill(0);
  for (let iter = 0; iter < iterations; iter += 1) {
    let changed = false;
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      if (!p) continue;
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centers.length; c += 1) {
        const center = centers[c];
        if (!center) continue;
        const d = distance(p, center);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      if (assignment[i] !== best) {
        assignment[i] = best;
        changed = true;
      }
    }

    const sums = centers.map(() => ({ l: 0, a: 0, b: 0, n: 0 }));
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      const s = sums[assignment[i] ?? 0];
      if (!p || !s) continue;
      s.l += p[0];
      s.a += p[1];
      s.b += p[2];
      s.n += 1;
    }
    for (let c = 0; c < centers.length; c += 1) {
      const s = sums[c];
      if (!s || s.n === 0) continue;
      centers[c] = [s.l / s.n, s.a / s.n, s.b / s.n];
    }
    if (!changed) break;
  }

  const counts = centers.map(() => 0);
  for (const a of assignment) counts[a] = (counts[a] ?? 0) + 1;

  return centers
    .map((lab, i) => ({ lab, rgb: labToRgb(lab), share: (counts[i] ?? 0) / points.length }))
    .filter((c) => c.share > 0);
}

function isGray(lab: Lab): boolean {
  return Math.hypot(lab[1], lab[2]) < GRAY_CHROMA;
}

function distance(a: Lab, b: Lab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// --------------------------------------------------------------- conversión

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const to = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** sRGB → CIELAB (D65). Lo justo para comparar colores como los ve el ojo. */
export function rgbToLab([r, g, b]: Rgb): Lab {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labToRgb([L, a, b]: Lab): Rgb {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const finv = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const x = finv(fx) * 0.95047;
  const y = finv(fy);
  const z = finv(fz) * 1.08883;
  const R = x * 3.2406 + y * -1.5372 + z * -0.4986;
  const G = x * -0.9689 + y * 1.8758 + z * 0.0415;
  const B = x * 0.0557 + y * -0.204 + z * 1.057;
  const gamma = (c: number) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.max(0, Math.min(1, v)) * 255;
  };
  return [gamma(R), gamma(G), gamma(B)];
}
