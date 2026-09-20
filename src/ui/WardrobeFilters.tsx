import { useState } from 'react';
import { CATEGORIES, type Category, type Garment } from '../db/types';
import { CATEGORY_LABELS } from '../db/labels';
import { ChipSelect, type ChipOption } from './ChipSelect';

export interface Filters {
  category: Category | null;
  color: string | null;
  tag: string | null;
}

export const NO_FILTERS: Filters = { category: null, color: null, tag: null };

export function applyFilters(garments: Garment[], f: Filters): Garment[] {
  return garments.filter(
    (g) =>
      (f.category === null || g.category === f.category) &&
      (f.color === null || g.colorName === f.color) &&
      (f.tag === null || g.tags.includes(f.tag)),
  );
}

export function activeCount(f: Filters): number {
  return [f.category, f.color, f.tag].filter((v) => v !== null).length;
}

interface Props {
  garments: Garment[];
  filters: Filters;
  onChange: (filters: Filters) => void;
}

/**
 * Filtros del armario, plegados tras un boton para no comerse la pantalla.
 * Las opciones de color y etiqueta salen de lo que hay en el armario.
 */
export function WardrobeFilters({ garments, filters, onChange }: Props) {
  const [open, setOpen] = useState(activeCount(filters) > 0);
  const count = activeCount(filters);

  const colors: ChipOption[] = [...new Map(garments.filter((g) => g.colorName).map((g) => [g.colorName, g.colorHex])).entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([name, hex]) => ({ value: name, label: name, swatch: hex }));
  const tags: ChipOption[] = [...new Set(garments.flatMap((g) => g.tags))]
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((t) => ({ value: t, label: t }));
  const categories: ChipOption[] = CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="chip inline-flex items-center gap-1.5"
          aria-expanded={open}
          aria-controls="wardrobe-filters"
          onClick={() => setOpen((v) => !v)}
        >
          <FilterIcon />
          Filtrar{count > 0 && ` (${count})`}
        </button>
        {count > 0 && (
          <button type="button" className="text-sm text-accent" onClick={() => onChange(NO_FILTERS)}>
            Quitar filtros
          </button>
        )}
      </div>
      {open && (
        <div id="wardrobe-filters" className="mt-3 flex flex-col gap-2">
          <ChipSelect
            label="Categoria"
            options={categories}
            value={filters.category}
            onChange={(v) => onChange({ ...filters, category: v as Category | null })}
          />
          {colors.length > 0 && (
            <ChipSelect label="Color" options={colors} value={filters.color} onChange={(v) => onChange({ ...filters, color: v })} allLabel="Cualquier color" />
          )}
          {tags.length > 0 && (
            <ChipSelect label="Etiqueta" options={tags} value={filters.tag} onChange={(v) => onChange({ ...filters, tag: v })} allLabel="Cualquier etiqueta" />
          )}
        </div>
      )}
    </div>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 5h18l-7 8v6l-4 2v-8z" />
    </svg>
  );
}
