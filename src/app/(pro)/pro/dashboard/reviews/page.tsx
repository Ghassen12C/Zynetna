import type { Metadata } from 'next';
import { EmptyState, Rating } from '@/components/ui/Primitives';
import { ReviewResponder } from '@/components/pro/ReviewResponder';
import { proContext } from '@/components/pro/ProGuard';
import { businessReviews } from '@/server/services/proDashboard';
import { db } from '@/lib/db';
import { formatDate } from '@/i18n/format';

export const metadata: Metadata = { title: 'Avis', robots: { index: false } };

export default async function ProReviewsPage() {
  const { businessId } = await proContext('business.read', '/pro/dashboard/reviews');

  const [reviews, business] = await Promise.all([
    businessReviews(businessId),
    db.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { ratingAverage: true, ratingCount: true },
    }),
  ]);

  if (reviews.length === 0) {
    return (
      <EmptyState
        title="Aucun avis pour l’instant"
        body="Après chaque rendez-vous terminé, vos clients peuvent laisser un avis vérifié."
      />
    );
  }

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-5)' }}>
      <div className="z-dash__panel-head">
        <div>
          <h2 className="z-profile__h3">Avis ({business.ratingCount})</h2>
          <p className="z-policy">
            Répondre à un avis montre à vos futurs clients que vous êtes à l’écoute.
          </p>
        </div>
        <Rating value={business.ratingAverage} count={business.ratingCount} />
      </div>

      <ul className="z-reviews__list">
        {reviews.map((review) => (
          <li key={review.id} className="z-review">
            <div className="z-review__head">
              <strong>
                {review.customer.firstName} {review.customer.lastName.charAt(0)}.
              </strong>
              <Rating value={review.rating} showValue={false} size={13} />
              <time dateTime={review.createdAt.toISOString()}>{formatDate(review.createdAt)}</time>
            </div>
            {review.reservation.items[0] ? (
              <p className="z-review__service">
                {review.reservation.items[0].serviceName} · {review.reservation.reference}
              </p>
            ) : null}
            {review.comment ? <p>{review.comment}</p> : null}

            <ReviewResponder
              reviewId={review.id}
              existing={review.response?.body ?? null}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
