import { useEffect } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { BottomNav } from './BottomNav';

/**
 * Marco comun: contenido con scroll y barra fija abajo. El padding inferior
 * del <main> reserva el hueco de la barra mas la zona segura del iPhone.
 *
 * Cada cambio de ruta funde la pantalla saliente y desliza la nueva. Se
 * captura el outlet con useOutlet para que AnimatePresence pueda seguir
 * pintando la pagina vieja mientras sale.
 */
export function Layout() {
  const location = useLocation();
  const outlet = useOutlet();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  );
}
