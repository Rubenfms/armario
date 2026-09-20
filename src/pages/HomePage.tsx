import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { db } from '../db/db';
import type { Garment, Outfit, WearLog } from '../db/types';
import { addWearLog, wearLogsSince } from '../db/wearLogs';
import { confetti } from '../lib/confetti';
import { loadPick, savePick } from '../lib/dailyPick';
import { REST_DAYS, seasonForDate, suggest, toDateKey, usableOutfits, type Suggestion } from '../lib/suggest';
import { scoreOutfit } from '../lib/style';
import { EmptyState } from '../ui/EmptyState';
import { LiveCollage } from '../ui/LiveCollage';
import { Loading } from '../ui/Loading';
import { ScoreCard } from '../ui/Score';
import { StorageWarning } from '../ui/StorageWarning';

/** A partir de esta nota, registrar el outfit tira confeti. */
const CONFETTI_FROM = 85;
/** Desplazamiento horizontal (px) a partir del cual soltar la tarjeta pide otra. */
const SWIPE_PX = 90;

export function HomePage() {
  const today = new Date();
  const todayKey = toDateKey(today);

  const garments = useLiveQuery(() => db.garments.toArray());
  const outfits = useLiveQuery(() => db.outfits.toArray());
  const recentLogs = useLiveQuery(() => {
    const from = new Date(today);
    from.setDate(from.getDate() - (REST_DAYS - 1));
    return wearLogsSince(toDateKey(from));
  }, [todayKey]);

  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [ready, setReady] = useState(false);
  // Tras registrar «me lo puse hoy» se muestra lo puesto; con esto se puede
  // pedir otra sugerencia igualmente (cambio de planes a media mañana).
  const [ignoreWorn, setIgnoreWorn] = useState(false);
  const [saving, setSaving] = useState(false);
  // Sentido del volteo: a la izquierda si se deslizó a la izquierda, etc.
  const [flipDir, setFlipDir] = useState(1);

  const loaded = garments !== undefined && outfits !== undefined && recentLogs !== undefined;

  // Primera sugerencia: restaurar la del día si sigue siendo válida; si no,
  // calcular una y guardarla.
  useEffect(() => {
    if (!loaded || ready) return;
    const restored = restore(garments, outfits, todayKey);
    const next = restored ?? suggest({ garments, outfits, wearLogs: recentLogs, today });
    if (next && !restored) savePick(todayKey, next);
    setSuggestion(next);
    setReady(true);
  }, [loaded, ready, garments, outfits, recentLogs, todayKey]);

  // Las prendas cambian por debajo (llega un recorte, se detecta el color):
  // la tarjeta debe verlo sin recargar, y la nota, recalcularse.
  useEffect(() => {
    if (!ready || !suggestion || !garments) return;
    const byId = new Map(garments.map((g) => [g.id, g]));
    const fresh = suggestion.garments.map((g) => byId.get(g.id)).filter((g): g is Garment => g !== undefined);
    if (fresh.length !== suggestion.garments.length) return;
    if (fresh.every((g, i) => g === suggestion.garments[i])) return;
    setSuggestion({ ...suggestion, garments: fresh, score: scoreOutfit(fresh, seasonForDate(new Date())) });
    // Solo interesa reaccionar a la tabla; `suggestion` cambia como efecto.
  }, [garments]);

  if (!loaded || !ready) return <Loading />;

  const active = garments.filter((g) => !g.archived);
  if (active.length === 0) {
    return (
      <>
        <Title todayKey={todayKey} />
        <EmptyState title="Nada que sugerir todavía" hint="Añade prendas en Armario y aquí aparecerá tu outfit del día." />
        <Link to="/armario" className="btn-primary mx-auto block w-full max-w-xs text-center">
          Ir al armario
        </Link>
      </>
    );
  }

  function another(avoid: string[] | undefined, dir = 1) {
    setFlipDir(dir);
    const next = suggest({
      garments: garments ?? [],
      outfits: outfits ?? [],
      wearLogs: recentLogs ?? [],
      today,
      avoid,
    });
    if (next) savePick(todayKey, next);
    setSuggestion(next);
  }

  const wornToday = recentLogs.filter((l) => l.date === todayKey);
  const lastWorn = wornToday[wornToday.length - 1];
  if (lastWorn && !ignoreWorn) {
    return (
      <>
        <Title todayKey={todayKey} />
        <WornCard log={lastWorn} garments={garments} outfits={outfits} />
        <button
          type="button"
          className="btn-secondary mt-4 w-full"
          onClick={() => {
            // Sugerencia fresca: la anterior se calculó antes de registrar
            // lo puesto y ya no vale.
            another(lastWorn.garmentIds);
            setIgnoreWorn(true);
          }}
        >
          Ver otra sugerencia
        </button>
      </>
    );
  }

  async function woreIt() {
    if (!suggestion) return;
    setSaving(true);
    try {
      await addWearLog({
        date: todayKey,
        garmentIds: suggestion.garments.map((g) => g.id),
        outfitId: suggestion.kind === 'guardado' ? suggestion.outfit.id : null,
        source: 'sugerido',
      });
      if (suggestion.score.total >= CONFETTI_FROM) confetti();
      setIgnoreWorn(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Title todayKey={todayKey} />
      {suggestion ? (
        <>
          <SuggestionCard
            suggestion={suggestion}
            flipDir={flipDir}
            onSwipe={(dir) => another(suggestion.garments.map((g) => g.id), dir)}
          />
          <div className="mt-4 flex flex-col gap-2">
            <button type="button" className="btn-primary" disabled={saving} onClick={woreIt}>
              Me lo puse hoy
            </button>
            <button type="button" className="btn-secondary" onClick={() => another(suggestion.garments.map((g) => g.id))}>
              Otra sugerencia
            </button>
            {suggestion.kind === 'nuevo' && <SaveAsOutfitButton garmentIds={suggestion.garments.map((g) => g.id)} />}
          </div>
          <p className="mt-3 text-center text-xs text-muted">Desliza la tarjeta para pedir otra.</p>
        </>
      ) : (
        <EmptyState
          title="Faltan prendas"
          hint="Para montar un outfit hace falta al menos una prenda superior, una inferior y un calzado sin archivar."
        />
      )}
    </>
  );
}

// --------------------------------------------------------------- piezas

function Title({ todayKey }: { todayKey: string }) {
  const [y, m, d] = todayKey.split('-').map(Number);
  const label = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return (
    <>
      <header className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hoy</h1>
          <p className="text-sm text-muted first-letter:uppercase">{label}</p>
        </div>
        <Link to="/ajustes" aria-label="Ajustes" className="-mr-2 p-2 text-muted">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </Link>
      </header>
      <StorageWarning />
    </>
  );
}

function suggestionKey(s: Suggestion): string {
  return (s.kind === 'guardado' ? s.outfit.id + ':' : 'nuevo:') + s.garments.map((g) => g.id).join(',');
}

/**
 * Tarjeta de la sugerencia. Al cambiar de sugerencia se voltea (la vieja
 * gira hasta desaparecer y la nueva entra girando desde el otro lado); se
 * puede arrastrar a los lados y, si se suelta lejos, pide otra.
 */
function SuggestionCard({ suggestion, flipDir, onSwipe }: { suggestion: Suggestion; flipDir: number; onSwipe: (dir: number) => void }) {
  const reduced = useReducedMotion();
  const isSaved = suggestion.kind === 'guardado';
  return (
    <div style={{ perspective: 1200 }}>
      <AnimatePresence mode="wait" initial={false} custom={flipDir}>
        <motion.article
          key={suggestionKey(suggestion)}
          custom={flipDir}
          variants={{
            enter: (dir: number) => ({ rotateY: reduced ? 0 : -70 * dir, opacity: 0, x: reduced ? 0 : 40 * dir }),
            center: { rotateY: 0, opacity: 1, x: 0 },
            exit: (dir: number) => ({ rotateY: reduced ? 0 : 70 * dir, opacity: 0, x: reduced ? 0 : -40 * dir }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.28, ease: 'easeInOut' }}
          drag={reduced ? false : 'x'}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.6}
          onDragEnd={(_e, info) => {
            if (Math.abs(info.offset.x) > SWIPE_PX) onSwipe(info.offset.x < 0 ? 1 : -1);
          }}
          whileDrag={{ scale: 0.98, cursor: 'grabbing' }}
          className="rounded-2xl border border-line bg-surface p-3"
          style={{ transformStyle: 'preserve-3d', touchAction: 'pan-y' }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="truncate text-lg font-semibold">{isSaved ? suggestion.outfit.name : 'Combinación nueva'}</h2>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                isSaved ? 'bg-accent text-white' : 'border border-accent text-accent'
              }`}
            >
              {isSaved ? 'Guardado' : 'Nuevo'}
            </span>
          </div>
          <LiveCollage garments={suggestion.garments} className="bg-bg" />
          <GarmentList garments={suggestion.garments} />
          <div className="mt-3">
            <ScoreCard score={suggestion.score} />
          </div>
          {suggestion.kind === 'nuevo' && suggestion.relaxed !== 'ninguna' && (
            <p className="mt-3 rounded-xl bg-bg px-3 py-2 text-xs text-muted">
              {suggestion.relaxed === 'repeticion'
                ? 'No quedaban prendas sin usar esta semana: se repite alguna.'
                : 'No hay prendas suficientes de esta temporada: se han incluido de otras.'}
            </p>
          )}
        </motion.article>
      </AnimatePresence>
    </div>
  );
}

function WornCard({ log, garments, outfits }: { log: WearLog; garments: Garment[]; outfits: Outfit[] }) {
  const byId = new Map(garments.map((g) => [g.id, g]));
  const worn = log.garmentIds.map((id) => byId.get(id)).filter((g): g is Garment => g !== undefined);
  const outfit = log.outfitId ? outfits.find((o) => o.id === log.outfitId) : undefined;
  const score = scoreOutfit(worn, seasonForDate(new Date()));
  return (
    <motion.article
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border border-line bg-surface p-3"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="truncate text-lg font-semibold">{outfit?.name ?? 'Lo de hoy'}</h2>
        <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-white">Puesto hoy ✓</span>
      </div>
      <LiveCollage garments={worn} className="bg-bg" />
      <GarmentList garments={worn} />
      <div className="mt-3">
        <ScoreCard score={score} />
      </div>
    </motion.article>
  );
}

function GarmentList({ garments }: { garments: Garment[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
      {garments.map((g) => (
        <li key={g.id}>
          <Link to={`/prenda/${g.id}`} className="text-ink underline-offset-2 hover:underline">
            {g.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SaveAsOutfitButton({ garmentIds }: { garmentIds: string[] }) {
  const navigate = useNavigate();
  return (
    <button type="button" className="btn-secondary" onClick={() => navigate('/outfits/nuevo', { state: { garmentIds } })}>
      Guardar como outfit
    </button>
  );
}

// --------------------------------------------------------------- helpers

/** Rehidrata la sugerencia guardada si todo lo que referencia sigue vivo. */
function restore(garments: Garment[], outfits: Outfit[], todayKey: string): Suggestion | null {
  const pick = loadPick(todayKey);
  if (!pick) return null;
  const byId = new Map(garments.map((g) => [g.id, g]));
  const picked = pick.garmentIds.map((id) => byId.get(id));
  if (picked.some((g) => g === undefined || g.archived)) return null;
  const chosen = picked.filter((g): g is Garment => g !== undefined);
  const score = scoreOutfit(chosen, seasonForDate(new Date()));

  if (pick.kind === 'guardado') {
    const outfit = outfits.find((o) => o.id === pick.outfitId);
    if (!outfit || !usableOutfits([outfit], garments).length) return null;
    return { kind: 'guardado', outfit, garments: chosen, score };
  }
  return { kind: 'nuevo', garments: chosen, relaxed: pick.relaxed, score };
}
