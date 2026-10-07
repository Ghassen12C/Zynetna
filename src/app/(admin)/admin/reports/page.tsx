import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { requireSuperAdmin } from '@/server/auth/guard';
import { ReportResolver } from '@/components/admin/ReportResolver';
import { translate } from '@/i18n/server';
import { formatDateTime } from '@/i18n/format';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.admin.nav.reports, robots: { index: false } };
}

const STATUSES = ['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'] as const;

/** Fill a template whose `{key}` placeholder is a link rather than text. */
function withNode(template: string, key: string, node: React.ReactNode) {
  const [before, after] = template.split(`{${key}}`);
  return (
    <>
      {before}
      {node}
      {after}
    </>
  );
}

const STATUS_TONE: Record<string, 'warning' | 'accent' | 'success' | 'neutral'> = {
  OPEN: 'warning',
  REVIEWING: 'accent',
  RESOLVED: 'success',
  DISMISSED: 'neutral',
};

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireSuperAdmin();
  const { m, locale, t, path } = await translate();
  const r = m.admin.reports;
  const { status } = await searchParams;

  const reports = await db.contentReport.findMany({
    where: status ? { status: status as 'OPEN' } : {},
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 80,
    include: {
      business: { select: { name: true, slug: true } },
      review: { select: { id: true, comment: true, rating: true, business: { select: { slug: true, name: true } } } },
      reporter: { select: { email: true, firstName: true, lastName: true } },
    },
  });

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-5)' }}>
      <div>
        <h1 className="z-search__title">{m.admin.nav.reports}</h1>
        <p className="z-policy">{r.lead}</p>
      </div>

      <nav
        className="z-row"
        style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}
        aria-label={m.admin.common.filterByStatus}
      >
        {[
          { value: '', label: m.admin.common.all },
          ...STATUSES.map((value) => ({ value, label: m.labels.reportStatus[value] })),
        ].map((tab) => (
          <Link
            key={tab.value}
            href={
              tab.value
                ? `${path('/admin/reports')}?status=${tab.value}`
                : path('/admin/reports')
            }
            className={`z-chip ${(status ?? '') === tab.value ? 'z-chip--active' : ''}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {reports.length === 0 ? (
        <EmptyState title={r.empty} body={r.emptyBody} />
      ) : (
        <ul className="z-reviews__list">
          {reports.map((report) => (
            <li key={report.id} className="z-review">
              <div className="z-review__head">
                <Badge tone={STATUS_TONE[report.status] ?? 'neutral'}>
                  {m.labels.reportStatus[report.status]}
                </Badge>
                <strong>{m.labels.reportTarget[report.targetType]}</strong>
                <time dateTime={report.createdAt.toISOString()}>
                  {formatDateTime(report.createdAt, locale)}
                </time>
              </div>

              <p>
                <strong>{r.reasonLabel}</strong> {report.reason}
              </p>
              {report.details ? <p className="z-help">{report.details}</p> : null}

              {report.business ? (
                <p className="z-review__service">
                  {r.businessLabel}{' '}
                  <Link href={path(`/business/${report.business.slug}`)}>
                    {report.business.name}
                  </Link>
                </p>
              ) : null}
              {report.review ? (
                <div className="z-review__response">
                  <strong>
                    {withNode(
                      // `t` leaves the unknown `{business}` in place for the link.
                      t(r.reportedReview, { rating: report.review.rating }),
                      'business',
                      <Link href={path(`/business/${report.review.business.slug}`)}>
                        {report.review.business.name}
                      </Link>,
                    )}
                  </strong>
                  <p>{report.review.comment ?? m.admin.common.noComment}</p>
                </div>
              ) : null}

              <p className="z-help">
                {t(r.reportedBy, {
                  who: report.reporter
                    ? t(r.reporter, {
                        name: `${report.reporter.firstName} ${report.reporter.lastName}`,
                        email: report.reporter.email,
                      })
                    : r.visitor,
                })}
              </p>

              {report.resolution ? (
                <p className="z-help">{t(r.resolution, { text: report.resolution })}</p>
              ) : null}

              {report.status === 'OPEN' || report.status === 'REVIEWING' ? (
                <ReportResolver reportId={report.id} m={m.admin} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
