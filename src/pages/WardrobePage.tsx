import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { CATEGORIES, type Garment } from '../db/types';
import { CATEGORY_LABELS } from '../db/labels';
import { setPendingPhoto } from '../lib/pendingPhoto';
import { useObjectUrl } from '../lib/useObjectUrl';
import { PhotoPicker } from '../ui/PhotoPicker';
import { CutoutBadge } from '../ui/CutoutStatus';

export function WardrobePage() {
  // Las más recientes primero dentro de cada categoría.
  const garments = useLiveQuery(() =>
    db.garments.toArray((all) => all.sort((a, b) => b.createdAt - a.createdAt)),
  );
  const [showArchived, setShowArchived] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const navigate = useNavigate();

  function handlePick(photo: File) {
    setPendingPhoto(photo);
    setPickerOpen(false);
    navigate('/armario/nueva');
  }

  if (!garments) return null; // Dexie resuelve en milisegundos: sin spinner.

  const active = garments.filter((g) => !g.archived);
  const archived = garments.filter((g) => g.archived);

  return (
    <>
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Armario</h1>
        {active.length > 0 && (
          <span className="text-sm text-muted">
            {active.length} {active.length === 1 ? 'prenda' : 'prendas'}
          </span>
        )}
      </header>

      {active.length === 0 && archived.length === 0 ? (
        <EmptyWardrobe />
      ) : (
        <div className="flex flex-col gap-6">
          {CATEGORIES.map((category) => {
            const items = active.filter((g) => g.category === category);
            if (items.length === 0) return null;
            return <CategorySection key={category} title={CATEGORY_LABELS[category]} items={items} />;
          })}

          {archived.length > 0 && (
            <section>
              <button
                type="button"
                className="text-sm text-muted underline-offset-2 hover:underline"
                onClick={() => setShowArchived((v) => !v)}
              >
                {showArchived ? 'Ocultar archivadas' : `Ver archivadas (${archived.length})`}
              </button>
              {showArchived && (
                <div className="mt-3">
                  <GarmentGrid items={archived} />
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Botón flotante, encima de la barra de navegación. */}
      <button
        type="button"
        aria-label="Añadir prenda"
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg active:opacity-90"
        onClick={() => setPickerOpen(true)}
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {pickerOpen && (
        <div
          className="fixed inset-0 z-20 flex items-end bg-black/40"
          onClick={() => setPickerOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Añadir prenda"
            className="mx-auto w-full max-w-md rounded-t-2xl bg-bg p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-lg font-semibold">Nueva prenda</h2>
            <PhotoPicker onPick={handlePick} />
            <button type="button" className="btn-secondary mt-2 w-full" onClick={() => setPickerOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function EmptyWardrobe() {
  return (
    <section className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-center">
      <h2 className="text-xl font-semibold">Tu armario está vacío</h2>
      <p className="max-w-xs text-sm text-muted">
        Pulsa el botón <strong>+</strong> y haz una foto a cada prenda. Mejor sobre un fondo liso y con
        buena luz: las fotos se recortarán automáticamente más adelante.
      </p>
    </section>
  );
}

function CategorySection({ title, items }: { title: string; items: Garment[] }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>
      <GarmentGrid items={items} />
    </section>
  );
}

function GarmentGrid({ items }: { items: Garment[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {items.map((g) => (
        <li key={g.id}>
          <GarmentCard garment={g} />
        </li>
      ))}
    </ul>
  );
}

function GarmentCard({ garment }: { garment: Garment }) {
  const src = useObjectUrl(garment.thumbnail);
  // El recorte va entero y con aire; la foto original, a sangre.
  const cutout = garment.useCutout && garment.imageCutout !== null;
  return (
    <Link to={`/prenda/${garment.id}`} className="block">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-surface">
        {src && (
          <img
            src={src}
            alt=""
            className={`h-full w-full ${cutout ? 'object-contain p-2' : 'object-cover'} ${
              garment.archived ? 'opacity-50 grayscale' : ''
            }`}
          />
        )}
        <CutoutBadge id={garment.id} />
      </div>
      <p className="mt-1.5 truncate text-sm font-medium">{garment.name}</p>
    </Link>
  );
}
