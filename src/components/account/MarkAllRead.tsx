'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { markNotificationsReadAction } from '@/server/actions/reviews';
import { formatCount } from '@/i18n/format';
import type { Locale, Messages } from '@/i18n';

export function MarkAllRead({
  count,
  locale,
  m,
}: {
  count: number;
  locale: Locale;
  m: Pick<Messages['account'], 'unreadCount' | 'markAllRead'>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="z-row" style={{ justifyContent: 'space-between', gap: 'var(--z-space-4)' }}>
      <span className="z-policy">{formatCount(m.unreadCount, count, locale)}</span>
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
        {m.markAllRead}
      </Button>
    </div>
  );
}
