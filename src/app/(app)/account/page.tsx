import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import { ReservationCard } from '@/components/booking/ReservationCard';
import { getActor } from '@/server/auth/session';
import { accountSummary, reviewableReservations, upcomingReservations } from '@/server/services/account';
import { formatDate } from '@/i18n/format';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.account.metaUpcoming, robots: { index: false } };
}

export default async function AccountPage() {
  const actor = await getActor();
  if (!actor) redirect('/login?redirectTo=/account');

  const [upcoming, summary, reviewable, { m, locale, path }] = await Promise.all([
    upcomingReservations(actor),
    accountSummary(actor),
    reviewableReservations(actor),
    translate(),
  ]);

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-8)' }}>
      <div className="z-stats">
        <div className="z-stat">
          <span className="z-stat__value">{summary.upcoming}</span>
          <span className="z-stat__label">{m.account.upcomingCount}</span>
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{summary.completed}</span>
          <span className="z-stat__label">{m.account.completedCount}</span>
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{summary.favorites}</span>
          <span className="z-stat__label">{m.account.favorites}</span>
        </div>
      </div>

      {reviewable.length > 0 ? (
        <section className="z-panel z-review-prompt">
          <div>
            <h2 className="z-profile__h3">{m.account.reviewPromptTitle}</h2>
            <p className="z-policy">
              {reviewable[0]!.business.name} —{' '}
              {reviewable[0]!.items[0]?.serviceName ?? m.account.yourService} ·{' '}
              {formatDate(reviewable[0]!.startAt, locale)}
            </p>
          </div>
          <ButtonLink href={path(`/account/reviews?reservation=${reviewable[0]!.id}`)}>
            {m.account.leaveReview}
          </ButtonLink>
        </section>
      ) : null}

      <section>
        <h2 className="z-profile__h3">{m.account.upcomingCount}</h2>
        {upcoming.length === 0 ? (
          <EmptyState
            title={m.account.noUpcoming}
            body={m.account.noUpcomingBody}
            action={
              <ButtonLink href={path('/search')}>{m.account.findPro}</ButtonLink>
            }
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
