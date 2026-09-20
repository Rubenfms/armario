import { ChipSelect } from './ChipSelect';

interface Props {
  tags: string[];
  active: string | null;
  onChange: (tag: string | null) => void;
}

/** Fila de chips: «Todas» mas una por etiqueta. Seleccion unica. */
export function TagFilter({ tags, active, onChange }: Props) {
  return (
    <div className="mb-4">
      <ChipSelect label="Filtrar por etiqueta" options={tags.map((t) => ({ value: t, label: t }))} value={active} onChange={onChange} />
    </div>
  );
}
