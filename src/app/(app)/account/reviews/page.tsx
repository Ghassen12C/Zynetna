import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState, Rating } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import { ReviewForm } from '@/components/review/ReviewForm';
import { getActor } from '@/server/auth/session';
import { myReviews, reviewableReservations } from '@/server/services/account';
import { formatDate } from '@/i18n/format';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.account.reviews, robots: { index: false } };
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ reservation?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect('/login?redirectTo=/account/reviews');

  const { reservation: target } = await searchParams;
  const [reviews, pending, { m, t, locale, path }] = await Promise.all([
    myReviews(actor),
    reviewableReservations(actor),
    translate(),
  ]);

  const focused = target ? pending.find((r) => r.id === target) : null;

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-10)' }}>
      {focused ? (
        <section>
          <h2 className="z-profile__h3">{m.account.leaveReview}</h2>
          <ReviewForm
            reservationId={focused.id}
            businessName={focused.business.name}
            serviceName={focused.items[0]?.serviceName}
          />
        </section>
      ) : pending.length > 0 ? (
        <section>
          <h2 className="z-profile__h3">{m.account.awaitingYourReview}</h2>
          <div className="z-stack" style={{ gap: 'var(--z-space-3)' }}>
            {pending.map((reservation) => (
              <div key={reservation.id} className="z-panel z-review-prompt">
                <div>
                  <strong>{reservation.business.name}</strong>
                  <p className="z-policy">
                    {reservation.items[0]?.serviceName} ·{' '}
                    {formatDate(reservation.startAt, locale)}
                  </p>
                </div>
                <ButtonLink href={path(`/account/reviews?reservation=${reservation.id}`)} size="sm">
                  {m.account.rate}
                </ButtonLink>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="z-profile__h3">{m.account.publishedReviews}</h2>
        {reviews.length === 0 ? (
          <EmptyState title={m.account.noReviewsYet} body={m.account.noReviewsYetBody} />
        ) : (
          <ul className="z-reviews__list">
            {reviews.map((review) => (
              <li key={review.id} className="z-review">
                <div className="z-review__head">
                  <strong>
                    <Link href={path(`/business/${review.business.slug}`)}>
                      {review.business.name}
                    </Link>
                  </strong>
                  <Rating value={review.rating} showValue={false} size={13} />
                  <time dateTime={review.createdAt.toISOString()}>
                    {formatDate(review.createdAt, locale)}
                  </time>
                </div>
                {review.reservation.items[0] ? (
                  <p className="z-review__service">{review.reservation.items[0].serviceName}</p>
                ) : null}
                {review.comment ? <p>{review.comment}</p> : null}
                {review.response ? (
                  <div className="z-review__response">
                    <strong>{t(m.business.responseFrom, { name: review.business.name })}</strong>
                    <p>{review.response.body}</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
