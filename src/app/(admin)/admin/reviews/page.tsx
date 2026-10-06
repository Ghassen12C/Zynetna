import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { Badge, EmptyState, Rating } from '@/components/ui/Primitives';
import { requireSuperAdmin } from '@/server/auth/guard';
import { ReviewModerator } from '@/components/admin/ReviewModerator';
import { formatDate } from '@/i18n/format';

export const metadata: Metadata = { title: 'Avis', robots: { index: false } };

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireSuperAdmin();
  const { status } = await searchParams;

  const reviews = await db.review.findMany({
    where: status ? { status: status as 'PUBLISHED' } : {},
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: {
      business: { select: { name: true, slug: true } },
      customer: { select: { firstName: true, lastName: true, email: true } },
      response: true,
      _count: { select: { reports: true } },
    },
  });

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-5)' }}>
      <h1 className="z-search__title">Avis</h1>

      <nav className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
        {[
          { value: '', label: 'Tous' },
          { value: 'PUBLISHED', label: 'Publiés' },
          { value: 'PENDING_MODERATION', label: 'À modérer' },
          { value: 'HIDDEN', label: 'Masqués' },
          { value: 'REMOVED', label: 'Supprimés' },
        ].map((tab) => (
          <Link
            key={tab.value}
            href={tab.value ? `/admin/reviews?status=${tab.value}` : '/admin/reviews'}
            className={`z-chip ${(status ?? '') === tab.value ? 'z-chip--active' : ''}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {reviews.length === 0 ? (
        <EmptyState title="Aucun avis" body="Aucun avis pour ce filtre." />
      ) : (
        <ul className="z-reviews__list">
          {reviews.map((review) => (
            <li key={review.id} className="z-review">
              <div className="z-review__head">
                <strong>
                  <Link href={`/business/${review.business.slug}`}>{review.business.name}</Link>
                </strong>
                <Rating value={review.rating} showValue={false} size={13} />
                <Badge
                  tone={
                    review.status === 'PUBLISHED'
                      ? 'success'
                      : review.status === 'PENDING_MODERATION'
                        ? 'warning'
                        : 'danger'
                  }
                >
                  {review.status}
                </Badge>
                {review._count.reports > 0 ? (
                  <Badge tone="danger">{review._count.reports} signalement(s)</Badge>
                ) : null}
                <time dateTime={review.createdAt.toISOString()}>
                  {formatDate(review.createdAt)}
                </time>
              </div>

              <p className="z-review__service">
                Par {review.customer.firstName} {review.customer.lastName} ·{' '}
                {review.customer.email}
              </p>

              {review.comment ? <p>{review.comment}</p> : <p className="z-help">(sans commentaire)</p>}

              {review.response ? (
                <div className="z-review__response">
                  <strong>Réponse de l’établissement</strong>
                  <p>{review.response.body}</p>
                </div>
              ) : null}

              {review.moderationNote ? (
                <p className="z-help">Note de modération : {review.moderationNote}</p>
              ) : null}

              <ReviewModerator reviewId={review.id} currentStatus={review.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
