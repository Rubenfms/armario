import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { deleteOutfit, updateOutfit, type OutfitFields } from '../db/outfits';
import { EmptyState } from '../ui/EmptyState';
import { OutfitEditor } from '../ui/OutfitEditor';
import { Loading } from '../ui/Loading';

export function OutfitPage() {
  const { id = '' } = useParams<{ id: string }>();
  const outfit = useLiveQuery(async () => (await db.outfits.get(id)) ?? null, [id]);
  // Las activas, más las archivadas que este outfit ya use: se ven atenuadas
  // pero siguen siendo editables.
  const memberIds = outfit?.garmentIds.join(',') ?? '';
  const garments = useLiveQuery(
    () => db.garments.filter((g) => !g.archived || memberIds.split(',').includes(g.id)).toArray(),
    [memberIds],
  );
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();

  if (outfit === undefined || garments === undefined) return <Loading />;

  if (outfit === null) {
    return (
      <>
        <BackLink />
        <EmptyState title="Outfit no encontrado" hint="Puede que lo hayas borrado." />
      </>
    );
  }

  async function handleSave(fields: OutfitFields) {
    await updateOutfit(id, fields);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleDelete(name: string) {
    if (!window.confirm(`¿Borrar el outfit «${name}»? Las prendas no se tocan.`)) return;
    await deleteOutfit(id);
    navigate('/outfits', { replace: true });
  }

  return (
    <>
      <BackLink />
      <h1 className="mt-2 mb-4 text-2xl font-semibold">{outfit.name}</h1>

      <OutfitEditor
        key={outfit.id}
        initial={{ name: outfit.name, garmentIds: outfit.garmentIds, tags: outfit.tags }}
        garments={garments}
        submitLabel={saved ? 'Guardado ✓' : 'Guardar cambios'}
        onSubmit={handleSave}
      />

      <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6">
        <button type="button" className="btn-danger" onClick={() => handleDelete(outfit.name)}>
          Borrar outfit
        </button>
      </div>
    </>
  );
}

function BackLink() {
  return (
    <Link to="/outfits" className="text-sm text-accent">
      ← Outfits
    </Link>
  );
}
