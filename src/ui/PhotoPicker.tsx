import { useId } from 'react';

interface Props {
  onPick: (photo: File) => void;
}

/**
 * Dos entradas de fichero: con `capture` el móvil abre la cámara directa; sin
 * él, la galería (en iOS ofrece además la cámara, pero Android no siempre).
 * Por eso van las dos y no una sola.
 */
export function PhotoPicker({ onPick }: Props) {
  const cameraId = useId();
  const galleryId = useId();

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Se vacía para que elegir la misma foto dos veces vuelva a disparar change.
    event.target.value = '';
    if (file) onPick(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={cameraId} className="btn-primary cursor-pointer">
        <CameraIcon />
        Hacer foto
      </label>
      <input
        id={cameraId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleChange}
      />
      <label htmlFor={galleryId} className="btn-secondary cursor-pointer">
        Elegir de la galería
      </label>
      <input id={galleryId} type="file" accept="image/*" className="sr-only" onChange={handleChange} />
    </div>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h3l2-2h6l2 2h3v12H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
