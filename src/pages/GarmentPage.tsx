import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '../ui/EmptyState';

export function GarmentPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <Link to="/armario" className="text-sm text-accent">
        ← Armario
      </Link>
      <EmptyState title="Prenda" hint={`Detalle de la prenda ${id ?? ''}. Pendiente.`} />
    </>
  );
}
