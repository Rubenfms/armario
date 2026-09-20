/**
 * Genera los iconos y las pantallas de arranque de la PWA sin depender de
 * ninguna librería de imagen: dibuja una percha con primitivas sobre un búfer
 * RGBA y lo codifica como PNG a mano (cabecera, IDAT deflateado y CRC32).
 *
 *   npm run icons
 *
 * Los PNG resultantes se commitean: el workflow de Pages solo hace `vite
 * build` y necesita encontrarlos ya hechos. Son la única excepción a la regla
 * de «ninguna imagen en el repo» del .gitignore.
 *
 * Salida (public/icons/):
 *   icon-192.png, icon-512.png       esquinas redondeadas, para el manifest
 *   icon-maskable-512.png            a sangre con zona segura, Android
 *   apple-touch-icon.png (180)       a sangre, iOS pone su propia máscara
 *   splash-<w>x<h>.png               arranque en iOS (una por tamaño de pantalla)
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// Fondo: degradado vertical de un piedra cálido a casi negro. Percha: ámbar.
const BG_TOP = [0x33, 0x2d, 0x29];
const BG_BOTTOM = [0x1c, 0x19, 0x17];
const FG = [0xf5, 0x9e, 0x0b];

/**
 * Pantallas de arranque de iPhone (px físicos, vertical). Los media queries
 * de index.html deben coincidir con estos tamaños; Android no necesita nada.
 */
const SPLASHES = [
  { w: 1320, h: 2868, dw: 440, dh: 956, r: 3 }, // 16 Pro Max
  { w: 1206, h: 2622, dw: 402, dh: 874, r: 3 }, // 16 Pro
  { w: 1290, h: 2796, dw: 430, dh: 932, r: 3 }, // 14/15 Pro Max, 16 Plus
  { w: 1179, h: 2556, dw: 393, dh: 852, r: 3 }, // 14 Pro, 15, 16
  { w: 1284, h: 2778, dw: 428, dh: 926, r: 3 }, // 12/13 Pro Max, 14 Plus
  { w: 1170, h: 2532, dw: 390, dh: 844, r: 3 }, // 12, 13, 14
  { w: 1080, h: 2340, dw: 360, dh: 780, r: 3 }, // 12/13 mini
  { w: 1125, h: 2436, dw: 375, dh: 812, r: 3 }, // X, XS, 11 Pro
  { w: 828, h: 1792, dw: 414, dh: 896, r: 2 }, // XR, 11
  { w: 750, h: 1334, dw: 375, dh: 667, r: 2 }, // SE 2/3, 8
];

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

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profundidad de bit
  ihdr[9] = 6; // color RGBA
  // 10..12: compresión, filtro e interlazado, todos 0.

  // Cada scanline lleva delante su byte de filtro; usamos 0 (sin filtro).
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
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

/** Distancia de un punto al segmento AB. */
function distToSegment(x, y, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.min(Math.max(((x - ax) * abx + (y - ay) * aby) / (abx * abx + aby * aby), 0), 1);
  return Math.hypot(x - (ax + abx * t), y - (ay + aby * t));
}

/**
 * Una percha en el cuadrado unitario: gancho abierto, cuello, hombros en V
 * invertida con las puntas redondeadas y barra inferior. `inset` encoge el
 * dibujo (zona segura de los iconos maskable).
 */
function isHanger(x, y, inset) {
  const px = 0.5 + (x - 0.5) / inset;
  const py = 0.5 + (y - 0.5) / inset;
  if (px < 0 || px > 1 || py < 0 || py > 1) return false;

  const W = 0.032; // medio grosor del trazo

  // Gancho: arco abierto hacia abajo-izquierda, centrado sobre el cuello.
  const hookR = 0.09;
  const hookCx = 0.5;
  const hookCy = 0.24;
  const d = Math.hypot(px - hookCx, py - hookCy);
  if (Math.abs(d - hookR) <= W) {
    const ang = Math.atan2(py - hookCy, px - hookCx); // -PI..PI, 0 = derecha
    // Se deja abierto el cuarto inferior izquierdo.
    if (!(ang > Math.PI * 0.5 && ang < Math.PI * 0.92)) return true;
  }
  // Punta del gancho redondeada.
  if (Math.hypot(px - (hookCx + hookR * Math.cos(Math.PI * 0.92)), py - (hookCy + hookR * Math.sin(Math.PI * 0.92))) <= W) return true;

  // Cuello: del gancho a la punta de los hombros.
  if (distToSegment(px, py, 0.5, hookCy + hookR, 0.5, 0.42) <= W) return true;

  // Hombros y barra.
  const left = [0.13, 0.74];
  const right = [0.87, 0.74];
  if (distToSegment(px, py, 0.5, 0.42, left[0], left[1]) <= W) return true;
  if (distToSegment(px, py, 0.5, 0.42, right[0], right[1]) <= W) return true;
  if (distToSegment(px, py, left[0], left[1], right[0], right[1]) <= W) return true;

  return false;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Pinta un lienzo `width`×`height`: fondo degradado (o transparente fuera de
 * las esquinas redondeadas) y la percha en un cuadrado centrado de lado
 * `iconSize`. Solo se supermuestrea dentro del cuadrado del icono; el resto
 * es fondo plano y no lo necesita.
 */
function render({ width, height, iconSize, corner = 0, inset = 1 }) {
  const rgba = Buffer.alloc(width * height * 4);
  const SS = 3;
  const ix0 = (width - iconSize) / 2;
  const iy0 = (height - iconSize) / 2;

  for (let y = 0; y < height; y += 1) {
    const t = y / (height - 1);
    const bg = [lerp(BG_TOP[0], BG_BOTTOM[0], t), lerp(BG_TOP[1], BG_BOTTOM[1], t), lerp(BG_TOP[2], BG_BOTTOM[2], t)];
    for (let x = 0; x < width; x += 1) {
      let inside = 0;
      let fg = 0;
      const inIconBox = x >= ix0 && x < ix0 + iconSize && y >= iy0 && y < iy0 + iconSize;
      const needsSampling = corner > 0 || inIconBox;
      if (!needsSampling) {
        inside = SS * SS;
      } else {
        for (let sy = 0; sy < SS; sy += 1) {
          for (let sx = 0; sx < SS; sx += 1) {
            const px = x + (sx + 0.5) / SS;
            const py = y + (sy + 0.5) / SS;
            const onCanvas = corner === 0 || inRoundRect(px / width, py / height, 0, 0, 1, 1, corner);
            if (!onCanvas) continue;
            inside += 1;
            if (inIconBox && isHanger((px - ix0) / iconSize, (py - iy0) / iconSize, inset)) fg += 1;
          }
        }
      }
      const total = SS * SS;
      const alpha = inside / total;
      const fgRatio = inside === 0 ? 0 : fg / inside;
      const offset = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) rgba[offset + c] = Math.round(lerp(bg[c], FG[c], fgRatio));
      rgba[offset + 3] = Math.round(255 * alpha);
    }
  }
  return encodePng(width, height, rgba);
}

// --------------------------------------------------------------- salida

mkdirSync(OUT_DIR, { recursive: true });

function emit(name, png) {
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`${name.padEnd(28)} ${(png.length / 1024).toFixed(1)} KB`);
}

emit('icon-192.png', render({ width: 192, height: 192, iconSize: 192, corner: 0.2 }));
emit('icon-512.png', render({ width: 512, height: 512, iconSize: 512, corner: 0.2 }));
emit('icon-maskable-512.png', render({ width: 512, height: 512, iconSize: 512, inset: 0.72 }));
emit('apple-touch-icon.png', render({ width: 180, height: 180, iconSize: 180, inset: 0.86 }));

for (const { w, h } of SPLASHES) {
  // El icono ocupa un cuarto del ancho: visible sin gritar.
  emit(`splash-${w}x${h}.png`, render({ width: w, height: h, iconSize: Math.round(w * 0.26) }));
}

// Media queries para index.html, por si cambia la lista.
console.log('\nEtiquetas para index.html:');
for (const { w, h, dw, dh, r } of SPLASHES) {
  console.log(
    `<link rel="apple-touch-startup-image" href="icons/splash-${w}x${h}.png" media="(device-width: ${dw}px) and (device-height: ${dh}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" />`,
  );
}
