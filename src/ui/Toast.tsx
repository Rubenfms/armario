import { AnimatePresence, motion } from 'motion/react';

interface Props {
  message: string | null;
  actionLabel?: string;
  onAction?: () => void;
}

/** Aviso breve sobre la barra de navegacion, con accion opcional (deshacer). */
export function Toast({ message, actionLabel, onAction }: Props) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key={message}
          role="status"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-bg shadow-lg"
        >
          <span>{message}</span>
          {actionLabel && onAction && (
            <button type="button" className="font-semibold text-accent" onClick={onAction}>
              {actionLabel}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
