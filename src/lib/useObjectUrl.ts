import { useEffect, useState } from 'react';

/**
 * URL temporal para pintar un Blob en un <img>. Se revoca al desmontar o al
 * cambiar de Blob; sin esto cada foto abierta se queda en memoria hasta que
 * se cierra la pestaña.
 */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  return url;
}
