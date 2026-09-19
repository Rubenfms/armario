import { useEffect, useState } from 'react';
import { CATEGORIES, type Category, type Garment } from '../db/types';
import { CATEGORY_LABELS } from '../db/labels';
import type { OutfitFields } from '../db/outfits';
import { renderCollage } from '../lib/collage';
import { parseTags } from '../lib/tags';
import { useObjectUrl } from '../lib/useObjectUrl';
import { CollageView } from './CollageView';

interface Props {
  initial: OutfitFields;
  /** Prendas elegibles: las activas más las archivadas que ya estén en el outfit. */
  garments: Garment[];
  submitLabel: string;
  disabled?: boolean;
  onSubmit: (fields: OutfitFields) => void;
}

export const EMPTY_OUTFIT: OutfitFields = { name: '', garmentIds: [], tags: [] };

/** Selector por categorías con vista previa del collage, nombre y etiquetas. */
export function OutfitEditor({ initial, garments, submitLabel, disabled = false, onSubmit }: Props) {
  const [name, setName] = useState(initial.name);
  const [tagsText, setTagsText] = useState(initial.tags.join(', '));
  const [selected, setSelected] = useState<string[]>(initial.garmentIds);
  const preview = useCollagePreview(garments, selected);

  function toggle(garment: Garment) {
    setSelected((current) => {
      if (current.includes(garment.id)) return current.filter((id) => id !== garment.id);
      // Una prenda por categoría, salvo accesorios: la nueva sustituye a la anterior.
      const rest =
        garment.category === 'accesorio'
          ? current
          : current.filter((id) => garments.find((g) => g.id === id)?.category !== garment.category);
      return [...rest, garment.id];
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || selected.length === 0) return;
    onSubmit({ name: trimmed, garmentIds: selected, tags: parseTags(tagsText) });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <CollageView src={preview} alt="Vista previa del outfit" />

      {CATEGORIES.map((category) => (
        <CategoryRow
          key={category}
          category={category}
          garments={garments.filter((g) => g.category === category)}
          selected={selected}
          onToggle={toggle}
        />
      ))}

      <div>
        <label htmlFor="outfit-name" className="label">
          Nombre
        </label>
        <input
          id="outfit-name"
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Viernes de oficina"
          autoComplete="off"
          required
        />
      </div>

      <div>
        <label htmlFor="outfit-tags" className="label">
          Etiquetas
        </label>
        <input
          id="outfit-tags"
          className="field"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="oficina, cena, verano"
          autoComplete="off"
        />
        <p className="mt-1.5 text-xs text-muted">Separadas por comas.</p>
      </div>

      <button type="submit" className="btn-primary" disabled={disabled || !name.trim() || selected.length === 0}>
        {submitLabel}
      </button>
    </form>
  );
}

function CategoryRow({
  category,
  garments,
  selected,
  onToggle,
}: {
  category: Category;
  garments: Garment[];
  selected: string[];
  onToggle: (garment: Garment) => void;
}) {
  return (
    <fieldset>
      <legend className="label">
        {CATEGORY_LABELS[category]}
        {category === 'accesorio' && <span className="font-normal"> · varios</span>}
      </legend>
      {garments.length === 0 ? (
        <p className="text-sm text-muted">No tienes prendas de esta categoría.</p>
      ) : (
        // Margen negativo + padding: la fila llega al borde de la pantalla al
        // hacer scroll, pero empieza alineada con el resto del formulario.
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {garments.map((g) => (
            <li key={g.id} className="shrink-0">
              <GarmentChoice garment={g} active={selected.includes(g.id)} onClick={() => onToggle(g)} />
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

function GarmentChoice({ garment, active, onClick }: { garment: Garment; active: boolean; onClick: () => void }) {
  const src = useObjectUrl(garment.thumbnail);
  const cutout = garment.useCutout && garment.imageCutout !== null;
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={garment.name}
      title={garment.name}
      onClick={onClick}
      className={`block h-20 w-20 overflow-hidden rounded-xl border-2 bg-surface ${
        active ? 'border-accent' : 'border-transparent'
      } ${garment.archived ? 'opacity-50' : ''}`}
    >
      {src && <img src={src} alt="" className={`h-full w-full ${cutout ? 'object-contain p-1' : 'object-cover'}`} />}
    </button>
  );
}

/**
 * Vista previa: se vuelve a pintar con cada cambio de selección, con un
 * pequeño retardo para no encadenar renders si se pulsa rápido. El contador
 * descarta resultados de renders ya superados.
 */
function useCollagePreview(garments: Garment[], selected: string[]): string | null {
  const [blob, setBlob] = useState<Blob | null>(null);
  const key = selected.join(',');

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      const chosen = selected.map((id) => garments.find((g) => g.id === id)).filter((g): g is Garment => !!g);
      void renderCollage(chosen)
        .then((result) => {
          if (!cancelled) setBlob(result);
        })
        .catch((err: unknown) => console.error('No se pudo pintar la vista previa', err));
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `key` resume `selected`; `garments` cambia de identidad con cada cambio
    // en la tabla, que es justo cuando puede haber llegado un recorte nuevo.
  }, [key, garments]);

  return useObjectUrl(blob);
}
