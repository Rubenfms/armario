interface Props {
  tags: string[];
  active: string | null;
  onChange: (tag: string | null) => void;
}

/** Fila de chips: «Todas» más una por etiqueta. Selección única. */
export function TagFilter({ tags, active, onChange }: Props) {
  if (tags.length === 0) return null;
  return (
    <ul className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Filtrar por etiqueta">
      <li className="shrink-0">
        <button type="button" className="chip" aria-pressed={active === null} onClick={() => onChange(null)}>
          Todas
        </button>
      </li>
      {tags.map((tag) => (
        <li key={tag} className="shrink-0">
          <button type="button" className="chip" aria-pressed={active === tag} onClick={() => onChange(tag)}>
            {tag}
          </button>
        </li>
      ))}
    </ul>
  );
}
