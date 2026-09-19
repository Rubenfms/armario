import { useState } from 'react';
import { CATEGORIES, SEASONS, type Category, type Season } from '../db/types';
import { CATEGORY_LABELS, SEASON_LABELS } from '../db/labels';
import type { GarmentFields } from '../db/garments';

interface Props {
  initial: GarmentFields;
  submitLabel: string;
  disabled?: boolean;
  onSubmit: (fields: GarmentFields) => void;
}

export const EMPTY_FIELDS: GarmentFields = {
  name: '',
  category: 'superior',
  seasons: [],
  tags: [],
};

/** Nombre, categoría, temporadas y etiquetas. Lo usan el alta y el detalle. */
export function GarmentForm({ initial, submitLabel, disabled = false, onSubmit }: Props) {
  const [name, setName] = useState(initial.name);
  const [category, setCategory] = useState<Category>(initial.category);
  const [seasons, setSeasons] = useState<Season[]>(initial.seasons);
  const [tagsText, setTagsText] = useState(initial.tags.join(', '));

  function toggleSeason(season: Season) {
    setSeasons((current) =>
      current.includes(season) ? current.filter((s) => s !== season) : [...current, season],
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({
      name: trimmed,
      category,
      // Se guardan en el orden canónico, no en el que se pulsaron.
      seasons: SEASONS.filter((s) => seasons.includes(s)),
      tags: parseTags(tagsText),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label htmlFor="garment-name" className="label">
          Nombre
        </label>
        <input
          id="garment-name"
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Camisa lino beige"
          autoComplete="off"
          required
        />
      </div>

      <fieldset>
        <legend className="label">Categoría</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === category}
              className="chip"
              onClick={() => setCategory(c)}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Temporadas</legend>
        <div className="flex flex-wrap gap-2">
          {SEASONS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={seasons.includes(s)}
              className="chip"
              onClick={() => toggleSeason(s)}
            >
              {SEASON_LABELS[s]}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">Sin ninguna marcada cuenta como todo el año.</p>
      </fieldset>

      <div>
        <label htmlFor="garment-tags" className="label">
          Etiquetas
        </label>
        <input
          id="garment-tags"
          className="field"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="oficina, boda, cómodo"
          autoComplete="off"
        />
        <p className="mt-1.5 text-xs text-muted">Separadas por comas.</p>
      </div>

      <button type="submit" className="btn-primary" disabled={disabled || !name.trim()}>
        {submitLabel}
      </button>
    </form>
  );
}

function parseTags(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of text.split(',')) {
    const tag = raw.trim().toLowerCase();
    if (tag) seen.add(tag);
  }
  return [...seen];
}
