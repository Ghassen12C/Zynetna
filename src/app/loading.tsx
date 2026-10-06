import { Skeleton } from '@/components/ui/Primitives';

/** Route-level loading state, so navigation never shows a blank screen. */
export default function Loading() {
  return (
    <div className="z-container" style={{ paddingBlock: 'var(--z-space-12)' }}>
      <span className="z-sr-only" role="status">
        Chargement…
      </span>
      <div className="z-stack" style={{ gap: 'var(--z-space-5)' }}>
        <Skeleton width="42%" height={36} radius={10} />
        <Skeleton width="68%" height={18} radius={6} />
        <div className="z-grid z-grid--3" style={{ marginTop: 'var(--z-space-6)' }}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="z-stack" style={{ gap: 'var(--z-space-3)' }}>
              <Skeleton height={190} radius={16} />
              <Skeleton width="72%" height={18} radius={6} />
              <Skeleton width="46%" height={14} radius={6} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
