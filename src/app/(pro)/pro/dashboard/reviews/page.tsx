import type { Metadata } from 'next';
import { EmptyState, Rating } from '@/components/ui/Primitives';
import { ReviewResponder } from '@/components/pro/ReviewResponder';
import { proContext } from '@/components/pro/ProGuard';
import { businessReviews } from '@/server/services/proDashboard';
import { db } from '@/lib/db';
import { formatDate, formatNumber } from '@/i18n/format';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.dash.nav.reviews, robots: { index: false } };
}

export default async function ProReviewsPage() {
  const { businessId } = await proContext('business.read', '/pro/dashboard/reviews');

  const [reviews, business, { m, locale, t }] = await Promise.all([
    businessReviews(businessId),
    db.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { ratingAverage: true, ratingCount: true },
    }),
    translate(),
  ]);
  const d = m.dash.reviews;
  // The shared star component announces itself in English, so it is hidden
  // from assistive technology here and the score is read out in the page's
  // own language instead.
  const rating = (value: number) =>
    t(d.ratingOutOf, {
      value: formatNumber(Math.round(value * 10) / 10, locale),
    });

  if (reviews.length === 0) {
    return (
      <EmptyState
        title={d.emptyTitle}
        body={d.emptyBody}
      />
    );
  }

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-5)' }}>
      <div className="z-dash__panel-head">
        <div>
          <h2 className="z-profile__h3">
            {t(d.title, { count: formatNumber(business.ratingCount, locale) })}
          </h2>
          <p className="z-policy">{d.intro}</p>
        </div>
        <span>
          <span aria-hidden="true">
            <Rating value={business.ratingAverage} count={business.ratingCount} />
          </span>
          <span className="z-sr-only">{rating(business.ratingAverage)}</span>
        </span>
      </div>

      <ul className="z-reviews__list">
        {reviews.map((review) => (
          <li key={review.id} className="z-review">
            <div className="z-review__head">
              <strong>
                {review.customer.firstName} {review.customer.lastName.charAt(0)}.
              </strong>
              <span aria-hidden="true">
                <Rating value={review.rating} showValue={false} size={13} />
              </span>
              <span className="z-sr-only">{rating(review.rating)}</span>
              <time dateTime={review.createdAt.toISOString()}>
                {formatDate(review.createdAt, locale)}
              </time>
            </div>
            {review.reservation.items[0] ? (
              <p className="z-review__service">
                {review.reservation.items[0].serviceName} ·{' '}
                <bdi dir="ltr">{review.reservation.reference}</bdi>
              </p>
            ) : null}
            {review.comment ? <p>{review.comment}</p> : null}

            <ReviewResponder
              m={{ reviews: d, common: m.common }}
              reviewId={review.id}
              existing={review.response?.body ?? null}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
