import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStorageInfo, STORAGE_WARN_RATIO } from '../lib/storage';

/** Aviso cuando el almacenamiento anda justo. Se consulta una vez por montaje. */
export function StorageWarning() {
  const [ratio, setRatio] = useState(0);
  useEffect(() => {
    void getStorageInfo().then((info) => setRatio(info?.ratio ?? 0));
  }, []);
  if (ratio < STORAGE_WARN_RATIO) return null;
  return (
    <p className="mb-4 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      Queda poco espacio ({Math.round(ratio * 100)} % usado).{' '}
      <Link to="/ajustes" className="underline">
        Exporta una copia
      </Link>{' '}
      y borra lo que no uses.
    </p>
  );
}
