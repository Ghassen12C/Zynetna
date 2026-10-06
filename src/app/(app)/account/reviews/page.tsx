import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState, Rating } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import { ReviewForm } from '@/components/review/ReviewForm';
import { getActor } from '@/server/auth/session';
import { myReviews, reviewableReservations } from '@/server/services/account';
import { formatDate } from '@/i18n/format';

export const metadata: Metadata = { title: 'Mes avis', robots: { index: false } };

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ reservation?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect('/login?redirectTo=/account/reviews');

  const { reservation: target } = await searchParams;
  const [reviews, pending] = await Promise.all([
    myReviews(actor),
    reviewableReservations(actor),
  ]);

  const focused = target ? pending.find((r) => r.id === target) : null;

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-10)' }}>
      {focused ? (
        <section>
          <h2 className="z-profile__h3">Laisser un avis</h2>
          <ReviewForm
            reservationId={focused.id}
            businessName={focused.business.name}
            serviceName={focused.items[0]?.serviceName}
          />
        </section>
      ) : pending.length > 0 ? (
        <section>
          <h2 className="z-profile__h3">En attente de votre avis</h2>
          <div className="z-stack" style={{ gap: 'var(--z-space-3)' }}>
            {pending.map((reservation) => (
              <div key={reservation.id} className="z-panel z-review-prompt">
                <div>
                  <strong>{reservation.business.name}</strong>
                  <p className="z-policy">
                    {reservation.items[0]?.serviceName} · {formatDate(reservation.startAt)}
                  </p>
                </div>
                <ButtonLink href={`/account/reviews?reservation=${reservation.id}`} size="sm">
                  Noter
                </ButtonLink>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="z-profile__h3">Avis publiés</h2>
        {reviews.length === 0 ? (
          <EmptyState
            title="Vous n’avez pas encore laissé d’avis"
            body="Après un rendez-vous terminé, vous pourrez partager votre expérience et aider les autres clients."
          />
        ) : (
          <ul className="z-reviews__list">
            {reviews.map((review) => (
              <li key={review.id} className="z-review">
                <div className="z-review__head">
                  <strong>
                    <Link href={`/business/${review.business.slug}`}>{review.business.name}</Link>
                  </strong>
                  <Rating value={review.rating} showValue={false} size={13} />
                  <time dateTime={review.createdAt.toISOString()}>
                    {formatDate(review.createdAt)}
                  </time>
                </div>
                {review.reservation.items[0] ? (
                  <p className="z-review__service">{review.reservation.items[0].serviceName}</p>
                ) : null}
                {review.comment ? <p>{review.comment}</p> : null}
                {review.response ? (
                  <div className="z-review__response">
                    <strong>Réponse de {review.business.name}</strong>
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
