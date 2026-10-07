'use client';

import { useRouter } from 'next/navigation';
import { useOptimistic, useState, useTransition } from 'react';
import { toggleFavoriteAction } from '@/server/actions/favorites';

const SPARKS = 7;

/**
 * Optimistic favourite toggle. The server is the source of truth; an
 * unauthenticated visitor is sent to sign in rather than silently losing the
 * action.
 *
 * Adding a favourite is a small moment of liking something, so it gets one:
 * the heart springs and a ring of jasmine sparks bursts outward. Removing is
 * quiet. The burst is keyed on a counter so it replays on every add, and it
 * is pure CSS — nothing runs once it has finished.
 */
export function FavoriteButton({
  businessId,
  initial,
  labels,
}: {
  businessId: string;
  initial: boolean;
  labels: { add: string; remove: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [isFavorite, setOptimistic] = useOptimistic(initial);
  const [burst, setBurst] = useState(0);

  return (
    <button
      type="button"
      className={`z-fav ${isFavorite ? 'is-on' : ''} ${isFavorite && burst > 0 ? 'is-popping' : ''}`}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? labels.remove : labels.add}
      // Not disabled while saving: a disabled button flickers and drops focus.
      aria-busy={pending}
      onClick={() => {
        if (pending) return;
        const next = !isFavorite;
        if (next) setBurst((n) => n + 1);
        startTransition(async () => {
          setOptimistic(next);
          const result = await toggleFavoriteAction(businessId);
          if (result.status === 'error') {
            router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`);
            return;
          }
          router.refresh();
        });
      }}
    >
      <svg className="z-fav__heart" width="19" height="19" viewBox="0 0 20 20" aria-hidden="true" key={`h${burst}`}>
        <path
          d="M10 17s-6.5-4.2-6.5-8.4A3.6 3.6 0 0 1 10 6.1a3.6 3.6 0 0 1 6.5 2.5C16.5 12.8 10 17 10 17Z"
          fill={isFavorite ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
      {burst > 0 && isFavorite ? (
        <span className="z-fav__burst" key={burst} aria-hidden="true">
          {Array.from({ length: SPARKS }, (_, i) => (
            <i key={i} style={{ ['--a' as string]: `${(360 / SPARKS) * i}deg` }} />
          ))}
        </span>
      ) : null}
    </button>
  );
}
