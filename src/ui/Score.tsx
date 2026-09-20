import { useEffect, useState } from 'react';
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react';
import type { StyleScore } from '../lib/style';

/** Color del anillo por banda de nota. */
export function scoreColor(total: number): string {
  if (total >= 85) return '#16a34a';
  if (total >= 70) return '#65a30d';
  if (total >= 55) return '#d97706';
  return '#dc2626';
}

interface RingProps {
  score: StyleScore;
  size?: number;
}

/** Anillo con la nota: el número sube y el arco se llena al aparecer. */
export function ScoreRing({ score, size = 56 }: RingProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? score.total : 0);
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const color = scoreColor(score.total);

  useEffect(() => {
    if (reduced) {
      setShown(score.total);
      return;
    }
    const controls = animate(0, score.total, {
      duration: 0.9,
      ease: 'easeOut',
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [score.total, reduced]);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Puntuación ${score.total} de 100: ${score.verdict}`}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - score.total / 100) }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-base font-semibold tabular-nums" style={{ color }}>
        {shown}
      </span>
    </div>
  );
}

interface CardProps {
  score: StyleScore;
  /** Abierto por defecto (editor) o plegado (tarjeta de Hoy). */
  defaultOpen?: boolean;
}

/** Nota con veredicto y desglose desplegable de cada regla. */
export function ScoreCard({ score, defaultOpen = false }: CardProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        className="flex w-full items-center gap-3 p-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ScoreRing score={score} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{score.verdict}</p>
          <p className="text-xs text-muted">{open ? 'Ocultar el porqué' : 'Ver el porqué'}</p>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-muted" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            key="parts"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {score.parts.map((p, i) => (
              <motion.li
                key={p.key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
                className="flex gap-3 border-t border-line px-3 py-2 text-sm"
              >
                <span className="w-14 shrink-0 text-right font-medium tabular-nums" style={{ color: scoreColor((p.points / p.max) * 100) }}>
                  {p.points}/{p.max}
                </span>
                <span className="min-w-0">
                  <span className="font-medium">{p.label}.</span> <span className="text-muted">{p.note}</span>
                </span>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Chip pequeño para listas. */
export function ScoreChip({ total }: { total: number }) {
  return (
    <span
      className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-white tabular-nums"
      style={{ backgroundColor: scoreColor(total) }}
      aria-label={`Puntuación ${total}`}
    >
      {total}
    </span>
  );
}
