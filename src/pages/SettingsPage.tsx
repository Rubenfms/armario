import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { backupFileName, exportBackup, readBackup, restoreBackup, summarize, type BackupSummary } from '../lib/backup';
import { resumePendingCutouts } from '../lib/cutout';
import { formatBytes, getStorageInfo, requestPersistence, STORAGE_WARN_RATIO, type StorageInfo } from '../lib/storage';
import { Spinner } from '../ui/CutoutStatus';

export function SettingsPage() {
  const counts = useLiveQuery(async () => ({
    garments: await db.garments.count(),
    outfits: await db.outfits.count(),
    wearLogs: await db.wearLogs.count(),
  }));

  return (
    <>
      <Link to="/" className="text-sm text-accent">
        ← Hoy
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold">Ajustes</h1>

      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold">Copia de seguridad</h2>
        <p className="mb-3 text-sm text-muted">
          Todo vive solo en este dispositivo. Exporta de vez en cuando y guarda el zip donde no se pierda.
          {counts && (
            <>
              {' '}
              Ahora mismo: {describe(counts)}.
            </>
          )}
        </p>
        <ExportButton />
        <ImportControl />
      </section>

      <StorageSection />

      <section className="mt-8 border-t border-line pt-6 text-xs text-muted">
        <p>Armario · sin cuentas, sin servidor. Los datos no salen del dispositivo salvo en tu copia.</p>
      </section>
    </>
  );
}

// --------------------------------------------------------------- exportar

function ExportButton() {
  const [state, setState] = useState<{ phase: 'idle' } | { phase: 'working'; done: number; total: number } | { phase: 'error'; message: string }>({
    phase: 'idle',
  });

  async function handleExport() {
    setState({ phase: 'working', done: 0, total: 0 });
    try {
      const blob = await exportBackup((done, total) => setState({ phase: 'working', done, total }));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName();
      document.body.append(a);
      a.click();
      a.remove();
      // El navegador necesita la URL viva hasta que arranca la descarga.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setState({ phase: 'idle' });
    } catch (err) {
      console.error(err);
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'No se pudo exportar.' });
    }
  }

  return (
    <div className="mb-3">
      <button type="button" className="btn-primary w-full" disabled={state.phase === 'working'} onClick={handleExport}>
        {state.phase === 'working' ? (
          <>
            <Spinner /> Preparando zip{state.total > 0 ? ` (${state.done}/${state.total})` : ''}
          </>
        ) : (
          'Exportar copia (.zip)'
        )}
      </button>
      {state.phase === 'error' && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.message}</p>}
    </div>
  );
}

// --------------------------------------------------------------- importar

type ImportState =
  | { phase: 'idle' }
  | { phase: 'reading' }
  | { phase: 'confirm'; file: File; summary: BackupSummary; exportedAt: string }
  | { phase: 'restoring' }
  | { phase: 'done'; summary: BackupSummary }
  | { phase: 'error'; message: string };

function ImportControl() {
  const inputId = useId();
  const [state, setState] = useState<ImportState>({ phase: 'idle' });

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setState({ phase: 'reading' });
    try {
      const { manifest } = await readBackup(file);
      setState({ phase: 'confirm', file, summary: summarize(manifest), exportedAt: manifest.exportedAt });
    } catch (err) {
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'No se pudo leer la copia.' });
    }
  }

  async function confirm(file: File) {
    setState({ phase: 'restoring' });
    try {
      // Se vuelve a leer: no se guardan los bytes descomprimidos en estado
      // para no duplicar cientos de MB en memoria mientras el usuario decide.
      const summary = await restoreBackup(await readBackup(file));
      setState({ phase: 'done', summary });
      // Prendas de la copia que aún no tenían recorte.
      void resumePendingCutouts();
    } catch (err) {
      console.error(err);
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'No se pudo restaurar la copia.' });
    }
  }

  return (
    <div>
      <label htmlFor={inputId} className={`btn-secondary w-full cursor-pointer ${state.phase === 'reading' || state.phase === 'restoring' ? 'pointer-events-none opacity-50' : ''}`}>
        {state.phase === 'reading' ? (
          <>
            <Spinner /> Leyendo…
          </>
        ) : (
          'Importar copia (.zip)'
        )}
      </label>
      <input id={inputId} type="file" accept=".zip,application/zip" className="sr-only" onChange={handleFile} />

      {state.phase === 'confirm' && (
        <div className="mt-3 rounded-xl border border-line bg-surface p-3 text-sm" role="alertdialog" aria-labelledby="import-title">
          <p id="import-title" className="font-medium">
            Copia del {formatDate(state.exportedAt)}: {describe(state.summary)}.
          </p>
          <p className="mt-1 text-muted">
            Al importar se <strong>sustituye todo</strong> lo que hay ahora en este dispositivo. No se puede deshacer.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-danger flex-1" onClick={() => confirm(state.file)}>
              Sustituir todo
            </button>
            <button type="button" className="btn-secondary flex-1" onClick={() => setState({ phase: 'idle' })}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {state.phase === 'restoring' && (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted">
          <Spinner /> Restaurando…
        </p>
      )}
      {state.phase === 'done' && (
        <p className="mt-2 text-sm text-muted">
          Restaurado: {describe(state.summary)}.
        </p>
      )}
      {state.phase === 'error' && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.message}</p>}
    </div>
  );
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function describe(s: BackupSummary): string {
  return `${plural(s.garments, 'prenda', 'prendas')}, ${plural(s.outfits, 'outfit', 'outfits')} y ${plural(s.wearLogs, 'día registrado', 'días registrados')}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'fecha desconocida' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

// --------------------------------------------------------------- almacenamiento

function StorageSection() {
  const [info, setInfo] = useState<StorageInfo | null | undefined>(undefined);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    void getStorageInfo().then(setInfo);
  }, []);

  async function persist() {
    setRequesting(true);
    await requestPersistence();
    setInfo(await getStorageInfo());
    setRequesting(false);
  }

  if (info === undefined) return null;

  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">Almacenamiento</h2>
      {info === null ? (
        <p className="text-sm text-muted">Este navegador no informa del espacio disponible.</p>
      ) : (
        <>
          <p className="text-sm text-muted">
            En uso: {formatBytes(info.usage)} de {formatBytes(info.quota)} ({Math.round(info.ratio * 100)} %).
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div
              className={`h-full ${info.ratio >= STORAGE_WARN_RATIO ? 'bg-red-500' : 'bg-accent'}`}
              style={{ width: `${Math.min(100, Math.round(info.ratio * 100))}%` }}
            />
          </div>
          {info.ratio >= STORAGE_WARN_RATIO && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              Queda poco espacio. Exporta una copia y borra prendas que no uses.
            </p>
          )}
          <p className="mt-3 text-sm text-muted">
            {info.persisted === null
              ? 'Este navegador no permite pedir almacenamiento persistente.'
              : info.persisted
                ? 'Almacenamiento persistente: el navegador no borrará los datos para liberar espacio.'
                : 'Almacenamiento no persistente: el navegador podría borrar los datos si le falta espacio.'}
          </p>
          {info.persisted === false && (
            <button type="button" className="btn-secondary mt-2 w-full" disabled={requesting} onClick={persist}>
              Pedir almacenamiento persistente
            </button>
          )}
        </>
      )}
    </section>
  );
}
