import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { Badge, EmptyState, Rating } from '@/components/ui/Primitives';
import { requireSuperAdmin } from '@/server/auth/guard';
import { ReviewModerator } from '@/components/admin/ReviewModerator';
import { translate } from '@/i18n/server';
import { formatCount, formatDate } from '@/i18n/format';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.admin.nav.reviews, robots: { index: false } };
}

const STATUSES = ['PUBLISHED', 'PENDING_MODERATION', 'HIDDEN', 'REMOVED'] as const;

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireSuperAdmin();
  const { m, locale, t, path } = await translate();
  const r = m.admin.reviews;
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
      <h1 className="z-search__title">{m.admin.nav.reviews}</h1>

      <nav
        className="z-row"
        style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}
        aria-label={m.admin.common.filterByStatus}
      >
        {[
          { value: '', label: m.admin.common.all },
          ...STATUSES.map((value) => ({ value, label: m.labels.reviewStatus[value] })),
        ].map((tab) => (
          <Link
            key={tab.value}
            href={
              tab.value
                ? `${path('/admin/reviews')}?status=${tab.value}`
                : path('/admin/reviews')
            }
            className={`z-chip ${(status ?? '') === tab.value ? 'z-chip--active' : ''}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {reviews.length === 0 ? (
        <EmptyState title={r.empty} body={r.emptyBody} />
      ) : (
        <ul className="z-reviews__list">
          {reviews.map((review) => (
            <li key={review.id} className="z-review">
              <div className="z-review__head">
                <strong>
                  <Link href={path(`/business/${review.business.slug}`)}>{review.business.name}</Link>
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
                  {m.labels.reviewStatus[review.status]}
                </Badge>
                {review._count.reports > 0 ? (
                  <Badge tone="danger">
                    {formatCount(r.reportsCount, review._count.reports, locale)}
                  </Badge>
                ) : null}
                <time dateTime={review.createdAt.toISOString()}>
                  {formatDate(review.createdAt, locale)}
                </time>
              </div>

              <p className="z-review__service">
                {t(r.by, {
                  name: `${review.customer.firstName} ${review.customer.lastName}`,
                  email: review.customer.email,
                })}
              </p>

              {review.comment ? <p>{review.comment}</p> : <p className="z-help">{m.admin.common.noComment}</p>}

              {review.response ? (
                <div className="z-review__response">
                  <strong>{r.businessResponse}</strong>
                  <p>{review.response.body}</p>
                </div>
              ) : null}

              {review.moderationNote ? (
                <p className="z-help">{t(r.moderationNote, { note: review.moderationNote })}</p>
              ) : null}

              <ReviewModerator
                reviewId={review.id}
                currentStatus={review.status}
                m={{ admin: m.admin, labels: m.labels, common: m.common }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
