import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { addOutfit, type OutfitFields } from '../db/outfits';
import { EMPTY_OUTFIT, OutfitEditor } from '../ui/OutfitEditor';

export function NewOutfitPage() {
  const garments = useLiveQuery(() => db.garments.filter((g) => !g.archived).toArray());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  // Desde la home, «Guardar como outfit» llega con las prendas ya elegidas.
  const state = useLocation().state as { garmentIds?: unknown } | null;
  const preselected = Array.isArray(state?.garmentIds) ? state.garmentIds.filter((id): id is string => typeof id === 'string') : [];

  if (!garments) return null;

  async function handleSubmit(fields: OutfitFields) {
    setSaving(true);
    setError(null);
    try {
      await addOutfit(fields);
      navigate('/outfits', { replace: true });
    } catch (err) {
      console.error(err);
      setError('No se pudo guardar el outfit.');
      setSaving(false);
    }
  }

  return (
    <>
      <Link to="/outfits" className="text-sm text-accent">
        ← Outfits
      </Link>
      <h1 className="mt-2 mb-4 text-2xl font-semibold">Nuevo outfit</h1>
      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <OutfitEditor
        initial={{ ...EMPTY_OUTFIT, garmentIds: preselected }}
        garments={garments}
        submitLabel={saving ? 'Guardando…' : 'Guardar outfit'}
        disabled={saving}
        onSubmit={handleSubmit}
      />
    </>
  );
}
