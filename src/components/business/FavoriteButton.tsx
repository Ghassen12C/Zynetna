'use client';

import { useRouter } from 'next/navigation';
import { useOptimistic, useTransition } from 'react';
import { toggleFavoriteAction } from '@/server/actions/favorites';

/**
 * Optimistic favourite toggle. The server is the source of truth; an
 * unauthenticated visitor is sent to sign in rather than silently losing the
 * action.
 */
export function FavoriteButton({
  businessId,
  initial,
}: {
  businessId: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [isFavorite, setOptimistic] = useOptimistic(initial);

  return (
    <button
      type="button"
      className={`z-fav ${isFavorite ? 'is-on' : ''}`}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          setOptimistic(!isFavorite);
          const result = await toggleFavoriteAction(businessId);
          if (result.status === 'error') {
            router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`);
            return;
          }
          router.refresh();
        });
      }}
    >
      <svg width="19" height="19" viewBox="0 0 20 20" aria-hidden="true">
        <path
          d="M10 17s-6.5-4.2-6.5-8.4A3.6 3.6 0 0 1 10 6.1a3.6 3.6 0 0 1 6.5 2.5C16.5 12.8 10 17 10 17Z"
          fill={isFavorite ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    </button>
  );
}
