/**
 * Confeti minimo sobre un canvas a pantalla completa. Sin dependencias; se
 * autodestruye al terminar. No hace nada si el usuario pide menos movimiento.
 */
export function confetti(colors: string[] = ['#f59e0b', '#b45309', '#fbbf24', '#fde68a', '#f4f4f2']): void {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:50';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  document.body.append(canvas);

  const W = window.innerWidth;
  const H = window.innerHeight;
  const pieces = Array.from({ length: 120 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * 80,
    y: H * 0.45,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 14 - 6,
    w: 6 + Math.random() * 6,
    h: 4 + Math.random() * 4,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    color: colors[Math.floor(Math.random() * colors.length)] ?? '#f59e0b',
  }));

  const start = performance.now();
  const DURATION = 1800;
  function frame(now: number) {
    const t = now - start;
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    for (const p of pieces) {
      p.vy += 0.35;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.99;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - t / DURATION);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (t < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
