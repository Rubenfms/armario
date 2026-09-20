import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import type { Garment } from '../db/types';
import { CATEGORY_LABELS } from '../db/labels';
import { seasonForDate } from '../lib/suggest';
import { bestPartners } from '../lib/style';
import { useObjectUrl } from '../lib/useObjectUrl';
import { ScoreChip } from './Score';

interface Props {
  garment: Garment;
  candidates: Garment[];
}

/** «Combina con»: las tres prendas de otras categorias que mejor casan con esta. */
export function Partners({ garment, candidates }: Props) {
  const partners = bestPartners(garment, candidates, seasonForDate(new Date()));
  const hasColor = garment.colorHex !== '';

  return (
    <section className="mb-5">
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Combina con</h2>
      {!hasColor ? (
        <p className="text-sm text-muted">Cuando se detecte el color de la prenda, aqui veras con que combina mejor.</p>
      ) : partners.length === 0 ? (
        <p className="text-sm text-muted">Aun no hay prendas de otras categorias con color detectado.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {partners.map((p, i) => (
            <motion.li key={p.garment.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <PartnerCard garment={p.garment} total={p.score.total} />
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PartnerCard({ garment, total }: { garment: Garment; total: number }) {
  const src = useObjectUrl(garment.thumbnail);
  const cutout = garment.useCutout && garment.imageCutout !== null;
  return (
    <Link to={`/prenda/${garment.id}`} className="block">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-surface">
        {src && <img src={src} alt="" className={`h-full w-full ${cutout ? 'object-contain p-1' : 'object-cover'}`} />}
        <span className="absolute top-1 right-1">
          <ScoreChip total={total} />
        </span>
      </div>
      <p className="mt-1 truncate text-xs font-medium">{garment.name}</p>
      <p className="truncate text-[11px] text-muted">{CATEGORY_LABELS[garment.category]}</p>
    </Link>
  );
}
