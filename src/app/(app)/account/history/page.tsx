import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import { ReservationCard } from '@/components/booking/ReservationCard';
import { getActor } from '@/server/auth/session';
import { pastReservations } from '@/server/services/account';

export const metadata: Metadata = { title: 'Historique', robots: { index: false } };

export default async function HistoryPage() {
  const actor = await getActor();
  if (!actor) redirect('/login?redirectTo=/account/history');

  const past = await pastReservations(actor);

  if (past.length === 0) {
    return (
      <EmptyState
        title="Aucun rendez-vous passé"
        body="Vos rendez-vous terminés apparaîtront ici."
        action={<ButtonLink href="/search">Trouver un professionnel</ButtonLink>}
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
