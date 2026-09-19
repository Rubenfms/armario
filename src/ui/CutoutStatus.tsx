import { useCutoutStore, type CutoutStatus } from '../lib/cutout';

export function useCutoutStatus(id: string): CutoutStatus | undefined {
  return useCutoutStore((s) => s.jobs[id]);
}

/** Texto corto del estado del recorte, para tarjeta y detalle. */
export function describeCutoutStatus(status: CutoutStatus): string {
  switch (status.state) {
    case 'cola':
      return 'En cola';
    case 'procesando':
      // Al acabar la descarga el modelo tarda un rato en cargarse: mejor
      // «Recortando» que un 100 % clavado.
      if (status.download && status.download.current < status.download.total) {
        const pct = Math.round((status.download.current / status.download.total) * 100);
        return `Descargando modelo ${pct}%`;
      }
      return 'Recortando…';
    case 'error':
      return 'Sin recortar';
  }
}

/** Etiqueta pequeña sobre la miniatura de la tarjeta. */
export function CutoutBadge({ id }: { id: string }) {
  const status = useCutoutStatus(id);
  if (!status) return null;
  const busy = status.state !== 'error';
  return (
    <span
      className={`absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        busy ? 'bg-black/60 text-white' : 'bg-surface/90 text-muted'
      }`}
    >
      {busy && <Spinner />}
      {describeCutoutStatus(status)}
    </span>
  );
}

export function Spinner() {
  return (
    <span
      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
  );
}
