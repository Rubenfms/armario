interface Props {
  title: string;
  hint: string;
}

/** Pantalla vacía. Las fases siguientes la sustituyen por contenido real. */
export function EmptyState({ title, hint }: Props) {
  return (
    <section className="flex min-h-[60dvh] flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="max-w-xs text-sm text-muted">{hint}</p>
    </section>
  );
}
