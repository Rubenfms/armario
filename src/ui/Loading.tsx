import { useEffect, useState } from 'react';
import { Spinner } from './CutoutStatus';

/**
 * Indicador de carga que solo aparece si la espera pasa de 300 ms: Dexie
 * suele responder antes y un parpadeo de spinner molesta mas que ayuda.
 */
export function Loading() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div className="flex min-h-[40dvh] items-center justify-center text-muted" role="status" aria-live="polite">
      <Spinner />
      <span className="ml-2 text-sm">Cargando</span>
    </div>
  );
}
