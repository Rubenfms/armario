import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { AnimatePresence } from 'motion/react';
import type { Garment, Outfit } from '../db/types';
import { seasonForDate } from '../lib/suggest';
import { scoreOutfit } from '../lib/style';
import { ScoreChip } from '../ui/Score';
import { StaggerItem } from '../ui/Stagger';
import { useObjectUrl } from '../lib/useObjectUrl';
import { CollageView } from '../ui/CollageView';
import { TagFilter } from '../ui/TagFilter';
import { Loading } from '../ui/Loading';

export function OutfitsPage() {
  const outfits = useLiveQuery(() =>
    db.outfits.toArray((all) => all.sort((a, b) => b.createdAt - a.createdAt)),
  );
  const garments = useLiveQuery(() => db.garments.toArray());
  const [tag, setTag] = useState<string | null>(null);
  const navigate = useNavigate();

  if (!outfits || !garments) return <Loading />;
  const garmentCount = garments.filter((g) => !g.archived).length;
  const byId = new Map(garments.map((g) => [g.id, g]));
  const season = seasonForDate(new Date());

  const tags = [...new Set(outfits.flatMap((o) => o.tags))].sort((a, b) => a.localeCompare(b, 'es'));
  const visible = tag === null ? outfits : outfits.filter((o) => o.tags.includes(tag));

  return (
    <>
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Outfits</h1>
        {outfits.length > 0 && (
          <span className="text-sm text-muted">
            {outfits.length} {outfits.length === 1 ? 'outfit' : 'outfits'}
          </span>
        )}
      </header>

      {outfits.length === 0 ? (
        <EmptyOutfits hasGarments={garmentCount > 0} />
      ) : (
        <>
          <TagFilter tags={tags} active={tag} onChange={setTag} />
          {visible.length === 0 ? (
            <p className="text-sm text-muted">Ningún outfit con la etiqueta «{tag}».</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              <AnimatePresence initial={true}>
                {visible.map((o, i) => (
                  <StaggerItem key={o.id} index={i}>
                    <OutfitCard
                      outfit={o}
                      score={scoreOutfit(o.garmentIds.map((id) => byId.get(id)).filter((g): g is Garment => g !== undefined), season).total}
                    />
                  </StaggerItem>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </>
      )}

      {garmentCount > 0 && (
        <button
          type="button"
          aria-label="Nuevo outfit"
          className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg active:opacity-90"
          onClick={() => navigate('/outfits/nuevo')}
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}
    </>
  );
}

function EmptyOutfits({ hasGarments }: { hasGarments: boolean }) {
  return (
    <section className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-center">
      <h2 className="text-xl font-semibold">Aún no hay outfits</h2>
      {hasGarments ? (
        <p className="max-w-xs text-sm text-muted">
          Pulsa <strong>+</strong> y elige una prenda de cada categoría. El collage se monta solo.
        </p>
      ) : (
        <p className="max-w-xs text-sm text-muted">
          Primero añade prendas en{' '}
          <Link to="/armario" className="text-accent">
            Armario
          </Link>
          ; después podrás combinarlas aquí.
        </p>
      )}
    </section>
  );
}

function OutfitCard({ outfit, score }: { outfit: Outfit; score: number }) {
  const src = useObjectUrl(outfit.collage);
  return (
    <Link to={`/outfit/${outfit.id}`} className="block">
      <div className="relative">
        <CollageView src={src} alt="" />
        <span className="absolute top-1.5 right-1.5">
          <ScoreChip total={score} />
        </span>
      </div>
      <p className="mt-1.5 truncate text-sm font-medium">{outfit.name}</p>
      {outfit.tags.length > 0 && <p className="truncate text-xs text-muted">{outfit.tags.join(' · ')}</p>}
    </Link>
  );
}
