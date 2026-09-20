import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addGarment, type GarmentFields } from '../db/garments';
import { takePendingPhoto } from '../lib/pendingPhoto';
import { enqueueCutout } from '../lib/cutout';
import { requestPersistence } from '../lib/storage';
import { useObjectUrl } from '../lib/useObjectUrl';
import { EMPTY_FIELDS, GarmentForm } from '../ui/GarmentForm';
import { PhotoPicker } from '../ui/PhotoPicker';

export function NewGarmentPage() {
  // Normalmente la foto viene ya elegida desde el armario; si se llega aquí
  // sin ella (recarga, enlace directo) se pide en la propia página.
  const [photo, setPhoto] = useState<Blob | null>(() => takePendingPhoto());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useObjectUrl(photo);
  const navigate = useNavigate();

  async function handleSubmit(fields: GarmentFields) {
    if (!photo) return;
    setSaving(true);
    setError(null);
    try {
      const id = await addGarment(fields, photo);
      enqueueCutout(id);
      // A partir de la primera prenda hay algo que perder: que el navegador
      // no vacíe IndexedDB para hacer sitio. Si lo deniega, no pasa nada.
      void requestPersistence();
      navigate('/armario', { replace: true });
    } catch (err) {
      console.error(err);
      setError('No se pudo guardar la prenda. Prueba con otra foto.');
      setSaving(false);
    }
  }

  return (
    <>
      <Link to="/armario" className="text-sm text-accent">
        ← Armario
      </Link>
      <h1 className="mt-2 mb-4 text-2xl font-semibold">Nueva prenda</h1>

      {photo && preview ? (
        <div className="mb-5">
          <img src={preview} alt="" className="mx-auto max-h-72 rounded-xl object-contain" />
          <button type="button" className="mt-2 w-full text-sm text-accent" onClick={() => setPhoto(null)}>
            Cambiar foto
          </button>
        </div>
      ) : (
        <div className="mb-5">
          <p className="label">Foto</p>
          <PhotoPicker onPick={setPhoto} />
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <GarmentForm
        initial={EMPTY_FIELDS}
        submitLabel={saving ? 'Guardando…' : 'Guardar prenda'}
        disabled={!photo || saving}
        onSubmit={handleSubmit}
      />
    </>
  );
}
