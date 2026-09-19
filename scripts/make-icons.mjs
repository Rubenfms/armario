/**
 * Genera los iconos placeholder de la PWA sin depender de ninguna librería
 * de imagen: dibuja una percha con primitivas sobre un búfer RGBA y lo
 * codifica como PNG a mano (cabecera, IDAT deflateado y CRC32).
 *
 *   npm run icons
 *
 * Los PNG resultantes se commitean: el workflow de Pages solo hace `vite
 * build` y necesita encontrarlos ya hechos. Son la única excepción a la regla
 * de «ninguna imagen en el repo» del .gitignore. Los iconos definitivos son
 * cosa de la Fase 5.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const BG = [0x1c, 0x19, 0x17, 0xff];
const FG = [0xf5, 0x9e, 0x0b, 0xff];

// --------------------------------------------------------------- PNG

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profundidad de bit
  ihdr[9] = 6; // color RGBA
  // 10..12: compresión, filtro e interlazado, todos 0.

  // Cada scanline lleva delante su byte de filtro; usamos 0 (sin filtro).
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --------------------------------------------------------------- dibujo

/** Rectángulo redondeado en coordenadas normalizadas [0,1]. */
function inRoundRect(x, y, x0, y0, x1, y1, r) {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function inRing(x, y, cx, cy, outer, inner) {
  const d = Math.hypot(x - cx, y - cy);
  return d <= outer && d >= inner;
}

/** Distancia de un punto al segmento AB. */
function distToSegment(x, y, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.min(Math.max(((x - ax) * abx + (y - ay) * aby) / (abx * abx + aby * aby), 0), 1);
  return Math.hypot(x - (ax + abx * t), y - (ay + aby * t));
}

/**
 * Una percha: gancho, hombros en V invertida y barra inferior. `inset`
 * encoge el dibujo para dejar la zona segura de los iconos maskable, a los
 * que el sistema les recorta los bordes.
 */
function isForeground(x, y, inset) {
  const px = 0.5 + (x - 0.5) / inset;
  const py = 0.5 + (y - 0.5) / inset;
  if (px < 0 || px > 1 || py < 0 || py > 1) return false;

  const W = 0.028; // medio grosor del trazo

  // Gancho: tres cuartos de anillo abierto abajo a la izquierda, más el cuello.
  if (inRing(px, py, 0.5, 0.235, 0.085 + W, 0.085 - W)) {
    const ang = Math.atan2(py - 0.235, px - 0.5);
    if (!(ang > Math.PI * 0.55 && ang < Math.PI * 0.95)) return true;
  }
  if (inRoundRect(px, py, 0.5 - W, 0.3, 0.5 + W, 0.4, W)) return true;

  // Hombros: de la punta (0.5, 0.4) a cada extremo (0.14/0.86, 0.72).
  if (distToSegment(px, py, 0.5, 0.4, 0.14, 0.72) <= W) return true;
  if (distToSegment(px, py, 0.5, 0.4, 0.86, 0.72) <= W) return true;

  // Barra inferior.
  if (inRoundRect(px, py, 0.14 - W, 0.72 - W, 0.86 + W, 0.72 + W, W)) return true;

  return false;
}

function render(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4);
  const inset = maskable ? 0.78 : 1;
  const corner = maskable ? 0 : 0.2;
  const SS = 3; // supersampling: sin esto los bordes quedan dentados

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let inside = 0;
      let fg = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const nx = (x + (sx + 0.5) / SS) / size;
          const ny = (y + (sy + 0.5) / SS) / size;
          const onCanvas = corner === 0 || inRoundRect(nx, ny, 0, 0, 1, 1, corner);
          if (!onCanvas) continue;
          inside += 1;
          if (isForeground(nx, ny, inset)) fg += 1;
        }
      }

      const total = SS * SS;
      const alpha = inside / total;
      const fgRatio = inside === 0 ? 0 : fg / inside;
      const offset = (y * size + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        rgba[offset + c] = Math.round(BG[c] + (FG[c] - BG[c]) * fgRatio);
      }
      rgba[offset + 3] = Math.round(255 * alpha);
    }
  }

  return encodePng(size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
const targets = [
  ['icon-192.png', 192, { maskable: false }],
  ['icon-512.png', 512, { maskable: false }],
  ['icon-maskable-512.png', 512, { maskable: true }],
];
for (const [name, size, opts] of targets) {
  const png = render(size, opts);
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`${name}  ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
}
