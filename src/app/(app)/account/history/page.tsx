import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import { ReservationCard } from '@/components/booking/ReservationCard';
import { getActor } from '@/server/auth/session';
import { pastReservations } from '@/server/services/account';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.account.history, robots: { index: false } };
}

export default async function HistoryPage() {
  const actor = await getActor();
  if (!actor) redirect('/login?redirectTo=/account/history');

  const [past, { m, path }] = await Promise.all([pastReservations(actor), translate()]);

  if (past.length === 0) {
    return (
      <EmptyState
        title={m.account.noPast}
        body={m.account.noPastBody}
        action={<ButtonLink href={path('/search')}>{m.account.findPro}</ButtonLink>}
      />
    );
  }

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-3)' }}>
      {past.map((reservation) => (
        <ReservationCard key={reservation.id} reservation={reservation} showReviewPrompt />
      ))}
    </div>
  );
}
