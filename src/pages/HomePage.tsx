import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Garment, Outfit, WearLog } from '../db/types';
import { addWearLog, wearLogsSince } from '../db/wearLogs';
import { renderCollage } from '../lib/collage';
import { loadPick, savePick } from '../lib/dailyPick';
import { REST_DAYS, suggest, toDateKey, usableOutfits, type Suggestion } from '../lib/suggest';
import { useObjectUrl } from '../lib/useObjectUrl';
import { CollageView } from '../ui/CollageView';
import { EmptyState } from '../ui/EmptyState';

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

  if (!loaded || !ready) return null;

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

  function another(avoid: string[] | undefined) {
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
          <SuggestionCard suggestion={suggestion} />
          <div className="mt-4 flex flex-col gap-2">
            <button type="button" className="btn-primary" disabled={saving} onClick={woreIt}>
              Me lo puse hoy
            </button>
            <button type="button" className="btn-secondary" onClick={() => another(suggestion.garments.map((g) => g.id))}>
              Otra sugerencia
            </button>
            {suggestion.kind === 'nuevo' && <SaveAsOutfitButton garmentIds={suggestion.garments.map((g) => g.id)} />}
          </div>
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
    <header className="mb-4">
      <h1 className="text-2xl font-semibold">Hoy</h1>
      <p className="text-sm text-muted first-letter:uppercase">{label}</p>
    </header>
  );
}

function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  const src = useSuggestionCollage(suggestion);
  const isSaved = suggestion.kind === 'guardado';
  return (
    <article className="rounded-2xl border border-line bg-surface p-3">
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
      <CollageView src={src} alt="Outfit sugerido" className="bg-bg" />
      <GarmentList garments={suggestion.garments} />
      {suggestion.kind === 'nuevo' && suggestion.relaxed !== 'ninguna' && (
        <p className="mt-3 rounded-xl bg-bg px-3 py-2 text-xs text-muted">
          {suggestion.relaxed === 'repeticion'
            ? 'No quedaban prendas sin usar esta semana: se repite alguna.'
            : 'No hay prendas suficientes de esta temporada: se han incluido de otras.'}
        </p>
      )}
    </article>
  );
}

function WornCard({ log, garments, outfits }: { log: WearLog; garments: Garment[]; outfits: Outfit[] }) {
  const byId = new Map(garments.map((g) => [g.id, g]));
  const worn = log.garmentIds.map((id) => byId.get(id)).filter((g): g is Garment => g !== undefined);
  const outfit = log.outfitId ? outfits.find((o) => o.id === log.outfitId) : undefined;
  const src = useSuggestionCollage(
    outfit ? { kind: 'guardado', outfit, garments: worn } : { kind: 'nuevo', garments: worn, relaxed: 'ninguna' },
  );
  return (
    <article className="rounded-2xl border border-line bg-surface p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="truncate text-lg font-semibold">{outfit?.name ?? 'Lo de hoy'}</h2>
        <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-white">Puesto hoy ✓</span>
      </div>
      <CollageView src={src} alt="Lo que llevas hoy" className="bg-bg" />
      <GarmentList garments={worn} />
    </article>
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

/** Collage cacheado del outfit si lo hay; si no, se pinta al vuelo. */
function useSuggestionCollage(suggestion: Suggestion): string | null {
  const cached = suggestion.kind === 'guardado' ? suggestion.outfit.collage : null;
  const [rendered, setRendered] = useState<Blob | null>(null);
  const key = suggestion.garments.map((g) => g.id).join(',');

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    void renderCollage(suggestion.garments).then((blob) => {
      if (!cancelled) setRendered(blob);
    });
    return () => {
      cancelled = true;
    };
    // `key` resume las prendas; no hace falta repintar por identidad.
  }, [cached, key]);

  return useObjectUrl(cached ?? rendered);
}

/** Rehidrata la sugerencia guardada si todo lo que referencia sigue vivo. */
function restore(garments: Garment[], outfits: Outfit[], todayKey: string): Suggestion | null {
  const pick = loadPick(todayKey);
  if (!pick) return null;
  const byId = new Map(garments.map((g) => [g.id, g]));
  const picked = pick.garmentIds.map((id) => byId.get(id));
  if (picked.some((g) => g === undefined || g.archived)) return null;
  const chosen = picked.filter((g): g is Garment => g !== undefined);

  if (pick.kind === 'guardado') {
    const outfit = outfits.find((o) => o.id === pick.outfitId);
    if (!outfit || !usableOutfits([outfit], garments).length) return null;
    return { kind: 'guardado', outfit, garments: chosen };
  }
  return { kind: 'nuevo', garments: chosen, relaxed: pick.relaxed };
}
