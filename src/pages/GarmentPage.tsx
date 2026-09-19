import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { deleteGarment, setGarmentArchived, updateGarment, type GarmentFields } from '../db/garments';
import { useObjectUrl } from '../lib/useObjectUrl';
import { GarmentForm } from '../ui/GarmentForm';
import { EmptyState } from '../ui/EmptyState';

export function GarmentPage() {
  const { id = '' } = useParams<{ id: string }>();
  // get() resuelve undefined si no existe, igual que el estado de carga del
  // hook; se convierte a null para distinguir ambos casos.
  const garment = useLiveQuery(async () => (await db.garments.get(id)) ?? null, [id]);
  const src = useObjectUrl(garment?.imageOriginal);
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();

  if (garment === undefined) return null; // cargando

  if (garment === null) {
    return (
      <>
        <BackLink />
        <EmptyState title="Prenda no encontrada" hint="Puede que la hayas borrado." />
      </>
    );
  }

  async function handleSave(fields: GarmentFields) {
    await updateGarment(id, fields);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleDelete(name: string) {
    if (!window.confirm(`¿Borrar «${name}»? No se puede deshacer.`)) return;
    await deleteGarment(id);
    navigate('/armario', { replace: true });
  }

  return (
    <>
      <BackLink />
      <h1 className="mt-2 mb-4 text-2xl font-semibold">{garment.name}</h1>

      <div className="mb-5 overflow-hidden rounded-xl bg-surface">
        {src && (
          <img
            src={src}
            alt={garment.name}
            className={`mx-auto max-h-96 object-contain ${garment.archived ? 'opacity-60' : ''}`}
          />
        )}
      </div>

      {garment.archived && (
        <p className="mb-4 rounded-xl border border-line px-3 py-2 text-sm text-muted">
          Prenda archivada: no aparece en el armario ni en las sugerencias.
        </p>
      )}

      <GarmentForm
        key={garment.id}
        initial={{
          name: garment.name,
          category: garment.category,
          seasons: garment.seasons,
          tags: garment.tags,
        }}
        submitLabel={saved ? 'Guardado ✓' : 'Guardar cambios'}
        onSubmit={handleSave}
      />

      <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setGarmentArchived(id, !garment.archived)}
        >
          {garment.archived ? 'Desarchivar' : 'Archivar'}
        </button>
        <button type="button" className="btn-danger" onClick={() => handleDelete(garment.name)}>
          Borrar prenda
        </button>
      </div>
    </>
  );
}

function BackLink() {
  return (
    <Link to="/armario" className="text-sm text-accent">
      ← Armario
    </Link>
  );
}
