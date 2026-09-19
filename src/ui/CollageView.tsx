interface Props {
  src: string | null;
  alt: string;
  className?: string;
}

/** Marco 3:4 para un collage; sin imagen muestra un hueco neutro. */
export function CollageView({ src, alt, className = '' }: Props) {
  return (
    <div className={`aspect-[3/4] overflow-hidden rounded-xl bg-surface ${className}`}>
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted">Sin prendas</div>
      )}
    </div>
  );
}
