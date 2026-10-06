'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { markNotificationsReadAction } from '@/server/actions/reviews';

export function MarkAllRead({ count }: { count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="z-row" style={{ justifyContent: 'space-between', gap: 'var(--z-space-4)' }}>
      <span className="z-policy">
        {count} notification{count > 1 ? 's' : ''} non lue{count > 1 ? 's' : ''}
      </span>
      <Button
        variant="ghost"
        size="sm"
        loading={pending}
        onClick={() =>
          start(async () => {
            await markNotificationsReadAction();
            router.refresh();
          })
        }
      >
        Tout marquer comme lu
      </Button>
    </div>
  );
}
