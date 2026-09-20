import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import {
  deleteGarment,
  displayImage,
  setGarmentArchived,
  setUseCutout,
  updateGarment,
  type GarmentFields,
} from '../db/garments';
import { enqueueCutout } from '../lib/cutout';
import { useObjectUrl } from '../lib/useObjectUrl';
import { GarmentForm } from '../ui/GarmentForm';
import { EmptyState } from '../ui/EmptyState';
import { Loading } from '../ui/Loading';
import { describeCutoutStatus, Spinner, useCutoutStatus } from '../ui/CutoutStatus';
import { Partners } from '../ui/Partners';

export function GarmentPage() {
  const { id = '' } = useParams<{ id: string }>();
  // get() resuelve undefined si no existe, igual que el estado de carga del
  // hook; se convierte a null para distinguir ambos casos.
  const garment = useLiveQuery(async () => (await db.garments.get(id)) ?? null, [id]);
  // Para «combina con»: solo activas y con color; el filtrado fino lo hace bestPartners.
  const candidates = useLiveQuery(() => db.garments.filter((g) => !g.archived && g.colorHex !== '').toArray());
  const src = useObjectUrl(garment ? displayImage(garment) : null);
  const status = useCutoutStatus(id);
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();

  if (garment === undefined) return <Loading />;

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

  const hasCutout = garment.imageCutout !== null;
  const showingCutout = garment.useCutout && hasCutout;
  const busy = status !== undefined && status.state !== 'error';

  return (
    <>
      <BackLink />
      <h1 className="mt-2 mb-4 text-2xl font-semibold">{garment.name}</h1>

      <div
        className={`mb-3 overflow-hidden rounded-xl ${
          showingCutout ? 'bg-[repeating-conic-gradient(var(--line)_0_25%,transparent_0_50%)] bg-size-[20px_20px]' : 'bg-surface'
        }`}
      >
        {src && (
          <img
            src={src}
            alt={garment.name}
            className={`mx-auto max-h-96 object-contain ${garment.archived ? 'opacity-60' : ''}`}
          />
        )}
      </div>

      {/* Recorte: estado, interruptor recorte/original y reprocesar. */}
      <div className="mb-5 flex flex-col gap-2">
        {status && (
          <p className="flex items-center gap-2 text-sm text-muted">
            {busy && <Spinner />}
            {status.state === 'error' ? `Sin recortar: ${status.message}` : describeCutoutStatus(status)}
          </p>
        )}
        {hasCutout && (
          <div className="flex rounded-xl border border-line p-1" role="radiogroup" aria-label="Imagen a usar">
            <SegmentButton active={garment.useCutout} onClick={() => setUseCutout(id, true)}>
              Usar recorte
            </SegmentButton>
            <SegmentButton active={!garment.useCutout} onClick={() => setUseCutout(id, false)}>
              Usar original
            </SegmentButton>
          </div>
        )}
        {!busy && (
          <button type="button" className="btn-secondary" onClick={() => enqueueCutout(id)}>
            {hasCutout ? 'Volver a recortar' : 'Recortar fondo'}
          </button>
        )}
      </div>

      {garment.archived && (
        <p className="mb-4 rounded-xl border border-line px-3 py-2 text-sm text-muted">
          Prenda archivada: no aparece en el armario ni en las sugerencias.
        </p>
      )}

      <Partners garment={garment} candidates={candidates ?? []} />

      <GarmentForm
        // El color llega en segundo plano: la clave remonta el formulario para
        // que aparezca el campo sin pisar lo que el usuario esté escribiendo
        // en otros casos.
        key={`${garment.id}:${garment.colorHex}`}
        initial={{
          name: garment.name,
          category: garment.category,
          seasons: garment.seasons,
          tags: garment.tags,
          colorName: garment.colorName,
        }}
        colorHex={garment.colorHex}
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

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      className={`flex-1 rounded-lg py-2 text-sm font-medium ${active ? 'bg-accent text-white' : 'text-muted'}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function BackLink() {
  return (
    <Link to="/armario" className="text-sm text-accent">
      ← Armario
    </Link>
  );
}
