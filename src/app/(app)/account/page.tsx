import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import { ReservationCard } from '@/components/booking/ReservationCard';
import { getActor } from '@/server/auth/session';
import { accountSummary, reviewableReservations, upcomingReservations } from '@/server/services/account';
import { formatDate } from '@/i18n/format';

export const metadata: Metadata = { title: 'Mes rendez-vous', robots: { index: false } };

export default async function AccountPage() {
  const actor = await getActor();
  if (!actor) redirect('/login?redirectTo=/account');

  const [upcoming, summary, reviewable] = await Promise.all([
    upcomingReservations(actor),
    accountSummary(actor),
    reviewableReservations(actor),
  ]);

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-8)' }}>
      <div className="z-stats">
        <div className="z-stat">
          <span className="z-stat__value">{summary.upcoming}</span>
          <span className="z-stat__label">Rendez-vous à venir</span>
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{summary.completed}</span>
          <span className="z-stat__label">Rendez-vous honorés</span>
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{summary.favorites}</span>
          <span className="z-stat__label">Favoris</span>
        </div>
      </div>

      {reviewable.length > 0 ? (
        <section className="z-panel z-review-prompt">
          <div>
            <h2 className="z-profile__h3">Comment s’est passé votre rendez-vous ?</h2>
            <p className="z-policy">
              {reviewable[0]!.business.name} —{' '}
              {reviewable[0]!.items[0]?.serviceName ?? 'votre prestation'} du{' '}
              {formatDate(reviewable[0]!.startAt)}
            </p>
          </div>
          <ButtonLink href={`/account/reviews?reservation=${reviewable[0]!.id}`}>
            Laisser un avis
          </ButtonLink>
        </section>
      ) : null}

      <section>
        <h2 className="z-profile__h3">Rendez-vous à venir</h2>
        {upcoming.length === 0 ? (
          <EmptyState
            title="Aucun rendez-vous à venir"
            body="Trouvez un professionnel près de chez vous et réservez en quelques secondes."
            action={<ButtonLink href="/search">Trouver un professionnel</ButtonLink>}
          />
        ) : (
          <div className="z-stack" style={{ gap: 'var(--z-space-3)' }}>
            {upcoming.map((reservation) => (
              <ReservationCard key={reservation.id} reservation={reservation} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
