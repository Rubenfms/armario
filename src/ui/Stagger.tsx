import { motion } from 'motion/react';
import type { ReactNode } from 'react';

/** Elemento de rejilla que entra fundido y subiendo, escalonado por indice (tope 12). */
export function StaggerItem({ index, children, className = '' }: { index: number; children: ReactNode; className?: string }) {
  return (
    <motion.li
      layout
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.25, delay: Math.min(index, 12) * 0.04, ease: 'easeOut' }}
    >
      {children}
    </motion.li>
  );
}
