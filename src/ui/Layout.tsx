import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';

/**
 * Marco común: contenido con scroll y barra fija abajo. El padding inferior
 * del <main> reserva el hueco de la barra más la zona segura del iPhone.
 */
export function Layout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
