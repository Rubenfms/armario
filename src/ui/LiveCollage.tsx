import { motion } from 'motion/react';
import type { Garment } from '../db/types';
import { displayImage } from '../db/garmentImage';
import { placeGarments } from '../lib/collage';
import { useObjectUrl } from '../lib/useObjectUrl';

interface Props {
  garments: Garment[];
  className?: string;
}

/**
 * Collage en DOM: cada prenda en su caja (las mismas que usa el canvas) y
 * entrando una tras otra. Para tarjetas y listas sigue valiendo el collage
 * cacheado como imagen; esto es para donde se mira de cerca.
 */
export function LiveCollage({ garments, className = '' }: Props) {
  const placed = placeGarments(garments);
  return (
    <div className={`relative aspect-[3/4] overflow-hidden rounded-xl bg-surface ${className}`}>
      {placed.length === 0 && (
        <div className="flex h-full items-center justify-center text-sm text-muted">Sin prendas</div>
      )}
      {placed.map(({ garment, box: [x, y, w, h] }, i) => (
        <motion.div
          key={garment.id}
          className="absolute"
          style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}
          initial={{ opacity: 0, scale: 0.8, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26, delay: 0.08 * i }}
        >
          <Piece garment={garment} />
        </motion.div>
      ))}
    </div>
  );
}

function Piece({ garment }: { garment: Garment }) {
  const src = useObjectUrl(displayImage(garment));
  if (!src) return null;
  return <img src={src} alt={garment.name} className="h-full w-full object-contain" draggable={false} />;
}
