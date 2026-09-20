export interface ChipOption {
  value: string;
  label: string;
  /** Muestra de color a la izquierda de la etiqueta. */
  swatch?: string;
}

interface Props {
  label: string;
  options: ChipOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  allLabel?: string;
}

/** Fila horizontal de chips de seleccion unica, con «Todas» para quitar el filtro. */
export function ChipSelect({ label, options, value, onChange, allLabel = 'Todas' }: Props) {
  if (options.length === 0) return null;
  return (
    <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label={label}>
      <li className="shrink-0">
        <button type="button" className="chip" aria-pressed={value === null} onClick={() => onChange(null)}>
          {allLabel}
        </button>
      </li>
      {options.map((o) => (
        <li key={o.value} className="shrink-0">
          <button
            type="button"
            className="chip inline-flex items-center gap-1.5"
            aria-pressed={value === o.value}
            onClick={() => onChange(value === o.value ? null : o.value)}
          >
            {o.swatch && <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: o.swatch }} aria-hidden="true" />}
            {o.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
