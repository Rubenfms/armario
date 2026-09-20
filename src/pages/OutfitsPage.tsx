import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Outfit } from '../db/types';
import { useObjectUrl } from '../lib/useObjectUrl';
import { CollageView } from '../ui/CollageView';
import { TagFilter } from '../ui/TagFilter';
import { Loading } from '../ui/Loading';

export function OutfitsPage() {
  const outfits = useLiveQuery(() =>
    db.outfits.toArray((all) => all.sort((a, b) => b.createdAt - a.createdAt)),
  );
  const garmentCount = useLiveQuery(() => db.garments.filter((g) => !g.archived).count());
  const [tag, setTag] = useState<string | null>(null);
  const navigate = useNavigate();

  if (!outfits || garmentCount === undefined) return <Loading />;

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
              {visible.map((o) => (
                <li key={o.id}>
                  <OutfitCard outfit={o} />
                </li>
              ))}
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

function OutfitCard({ outfit }: { outfit: Outfit }) {
  const src = useObjectUrl(outfit.collage);
  return (
    <Link to={`/outfit/${outfit.id}`} className="block">
      <CollageView src={src} alt="" />
      <p className="mt-1.5 truncate text-sm font-medium">{outfit.name}</p>
      {outfit.tags.length > 0 && <p className="truncate text-xs text-muted">{outfit.tags.join(' · ')}</p>}
    </Link>
  );
}
