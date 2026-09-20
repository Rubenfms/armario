import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CATEGORIES, type Category, type Garment } from '../db/types';
import { CATEGORY_LABELS } from '../db/labels';
import type { OutfitFields } from '../db/outfits';
import { seasonForDate } from '../lib/suggest';
import { scoreOutfit } from '../lib/style';
import { parseTags } from '../lib/tags';
import { useObjectUrl } from '../lib/useObjectUrl';
import { LiveCollage } from './LiveCollage';
import { ScoreCard } from './Score';

interface Props {
  initial: OutfitFields;
  /** Prendas elegibles: las activas más las archivadas que ya estén en el outfit. */
  garments: Garment[];
  submitLabel: string;
  disabled?: boolean;
  onSubmit: (fields: OutfitFields) => void;
}

export const EMPTY_OUTFIT: OutfitFields = { name: '', garmentIds: [], tags: [] };

/**
 * Selector por categorías con vista previa del collage (que se monta pieza a
 * pieza) y la puntuación en vivo de lo que hay elegido, más nombre y etiquetas.
 */
export function OutfitEditor({ initial, garments, submitLabel, disabled = false, onSubmit }: Props) {
  const [name, setName] = useState(initial.name);
  const [tagsText, setTagsText] = useState(initial.tags.join(', '));
  const [selected, setSelected] = useState<string[]>(initial.garmentIds);
  const chosen = useMemo(
    () => selected.map((id) => garments.find((g) => g.id === id)).filter((g): g is Garment => g !== undefined),
    [selected, garments],
  );
  const score = useMemo(() => (chosen.length > 0 ? scoreOutfit(chosen, seasonForDate(new Date())) : null), [chosen]);

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
      <LiveCollage garments={chosen} />
      {score && <ScoreCard score={score} defaultOpen />}

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
          {garments.map((g, i) => (
            <motion.li
              key={g.id}
              className="shrink-0"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.04 }}
            >
              <GarmentChoice garment={g} active={selected.includes(g.id)} onClick={() => onToggle(g)} />
            </motion.li>
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
    <motion.button
      type="button"
      aria-pressed={active}
      aria-label={garment.name}
      title={garment.name}
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      animate={{ scale: active ? 1.04 : 1 }}
      className={`block h-20 w-20 overflow-hidden rounded-xl border-2 bg-surface ${
        active ? 'border-accent' : 'border-transparent'
      } ${garment.archived ? 'opacity-50' : ''}`}
    >
      {src && <img src={src} alt="" className={`h-full w-full ${cutout ? 'object-contain p-1' : 'object-cover'}`} draggable={false} />}
    </motion.button>
  );
}
