import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { setGarmentArchived } from '../db/garments';
import { StaggerItem } from '../ui/Stagger';
import { Toast } from '../ui/Toast';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { CATEGORIES, type Garment } from '../db/types';
import { CATEGORY_LABELS } from '../db/labels';
import { setPendingPhoto } from '../lib/pendingPhoto';
import { useObjectUrl } from '../lib/useObjectUrl';
import { PhotoPicker } from '../ui/PhotoPicker';
import { CutoutBadge } from '../ui/CutoutStatus';
import { Loading } from '../ui/Loading';
import { activeCount, applyFilters, NO_FILTERS, WardrobeFilters, type Filters } from '../ui/WardrobeFilters';

export function WardrobePage() {
  // Las más recientes primero dentro de cada categoría.
  const garments = useLiveQuery(() =>
    db.garments.toArray((all) => all.sort((a, b) => b.createdAt - a.createdAt)),
  );
  const [showArchived, setShowArchived] = useState(false);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; undo: () => void } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const navigate = useNavigate();

  function showToast(message: string, undo: () => void) {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ message, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }

  async function swipeArchive(garment: Garment) {
    const next = !garment.archived;
    await setGarmentArchived(garment.id, next);
    showToast(next ? `«${garment.name}» archivada` : `«${garment.name}» recuperada`, () => {
      void setGarmentArchived(garment.id, !next);
      setToast(null);
    });
  }

  function handlePick(photo: File) {
    setPendingPhoto(photo);
    setPickerOpen(false);
    navigate('/armario/nueva');
  }

  if (!garments) return <Loading />;

  const filtering = activeCount(filters) > 0;
  const filtered = applyFilters(garments, filters);
  const active = filtered.filter((g) => !g.archived);
  const archived = filtered.filter((g) => g.archived);
  const isEmpty = garments.length === 0;

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

      {!isEmpty && <WardrobeFilters garments={garments} filters={filters} onChange={setFilters} />}

      {isEmpty ? (
        <EmptyWardrobe />
      ) : active.length === 0 && archived.length === 0 ? (
        <p className="text-sm text-muted">Ninguna prenda coincide con los filtros.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {filtering && active.length === 0 && <p className="text-sm text-muted">Solo hay coincidencias entre las archivadas.</p>}
          {CATEGORIES.map((category) => {
            const items = active.filter((g) => g.category === category);
            if (items.length === 0) return null;
            return <CategorySection key={category} title={CATEGORY_LABELS[category]} items={items} onSwipe={swipeArchive} />;
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
                  <GarmentGrid items={archived} onSwipe={swipeArchive} />
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

      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            key="sheet"
            className="fixed inset-0 z-20 flex items-end bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPickerOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-label="Añadir prenda"
              className="mx-auto w-full max-w-md rounded-t-2xl bg-bg p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 36 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-3 text-lg font-semibold">Nueva prenda</h2>
              <PhotoPicker onPick={handlePick} />
              <button type="button" className="btn-secondary mt-2 w-full" onClick={() => setPickerOpen(false)}>
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast message={toast?.message ?? null} actionLabel="Deshacer" onAction={toast?.undo} />
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

type SwipeHandler = (garment: Garment) => void;

function CategorySection({ title, items, onSwipe }: { title: string; items: Garment[]; onSwipe: SwipeHandler }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>
      <GarmentGrid items={items} onSwipe={onSwipe} />
    </section>
  );
}

function GarmentGrid({ items, onSwipe }: { items: Garment[]; onSwipe: SwipeHandler }) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      <AnimatePresence initial={true}>
        {items.map((g, i) => (
          <StaggerItem key={g.id} index={i}>
            <GarmentCard garment={g} onSwipe={onSwipe} />
          </StaggerItem>
        ))}
      </AnimatePresence>
    </ul>
  );
}

/** Desplazamiento (px) a partir del cual soltar la tarjeta la archiva. */
const SWIPE_PX = 80;

/**
 * Tarjeta con gesto: deslizar a la izquierda archiva (o recupera si ya lo
 * estaba). Debajo asoma la etiqueta de lo que va a pasar. Un arrastre corto
 * no cuenta como toque: no abre el detalle.
 */
function GarmentCard({ garment, onSwipe }: { garment: Garment; onSwipe: SwipeHandler }) {
  const src = useObjectUrl(garment.thumbnail);
  const reduced = useReducedMotion();
  const dragged = useRef(false);
  // El recorte va entero y con aire; la foto original, a sangre.
  const cutout = garment.useCutout && garment.imageCutout !== null;
  return (
    <div className="relative">
      <div
        className="absolute inset-0 flex items-center justify-end rounded-xl bg-accent pr-3 text-xs font-semibold text-white"
        aria-hidden="true"
      >
        {garment.archived ? 'Recuperar' : 'Archivar'}
      </div>
      <motion.div
        drag={reduced ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.7, right: 0.1 }}
        dragDirectionLock
        onDragStart={() => {
          dragged.current = true;
        }}
        onDragEnd={(_e, info) => {
          if (info.offset.x < -SWIPE_PX) onSwipe(garment);
          window.setTimeout(() => {
            dragged.current = false;
          }, 50);
        }}
        className="relative bg-bg"
        style={{ touchAction: 'pan-y' }}
      >
    <Link
      to={`/prenda/${garment.id}`}
      className="block"
      draggable={false}
      onClick={(e) => {
        if (dragged.current) e.preventDefault();
      }}
    >
      <div className="relative aspect-square overflow-hidden rounded-xl bg-surface">
        {src && (
          <img
            src={src}
            alt=""
            draggable={false}
            className={`h-full w-full ${cutout ? 'object-contain p-2' : 'object-cover'} ${
              garment.archived ? 'opacity-50 grayscale' : ''
            }`}
          />
        )}
        <CutoutBadge id={garment.id} />
      </div>
      <p className="mt-1.5 truncate text-sm font-medium">{garment.name}</p>
    </Link>
      </motion.div>
    </div>
  );
}
