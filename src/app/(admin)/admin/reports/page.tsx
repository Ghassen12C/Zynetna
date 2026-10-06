import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { requireSuperAdmin } from '@/server/auth/guard';
import { ReportResolver } from '@/components/admin/ReportResolver';
import { formatDateTime } from '@/i18n/format';

export const metadata: Metadata = { title: 'Signalements', robots: { index: false } };

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
        <h1 className="z-search__title">Signalements</h1>
        <p className="z-policy">
          Contenus signalés par les utilisateurs — profils, avis ou images.
        </p>
      </div>

      <nav className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
        {[
          { value: '', label: 'Tous' },
          { value: 'OPEN', label: 'Ouverts' },
          { value: 'REVIEWING', label: 'En cours' },
          { value: 'RESOLVED', label: 'Traités' },
          { value: 'DISMISSED', label: 'Rejetés' },
        ].map((tab) => (
          <Link
            key={tab.value}
            href={tab.value ? `/admin/reports?status=${tab.value}` : '/admin/reports'}
            className={`z-chip ${(status ?? '') === tab.value ? 'z-chip--active' : ''}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {reports.length === 0 ? (
        <EmptyState
          title="Aucun signalement"
          body="Rien à modérer. Les signalements des utilisateurs apparaîtront ici."
        />
      ) : (
        <ul className="z-reviews__list">
          {reports.map((report) => (
            <li key={report.id} className="z-review">
              <div className="z-review__head">
                <Badge tone={STATUS_TONE[report.status] ?? 'neutral'}>{report.status}</Badge>
                <strong>{report.targetType}</strong>
                <time dateTime={report.createdAt.toISOString()}>
                  {formatDateTime(report.createdAt)}
                </time>
              </div>

              <p>
                <strong>Motif :</strong> {report.reason}
              </p>
              {report.details ? <p className="z-help">{report.details}</p> : null}

              {report.business ? (
                <p className="z-review__service">
                  Établissement :{' '}
                  <Link href={`/business/${report.business.slug}`}>{report.business.name}</Link>
                </p>
              ) : null}
              {report.review ? (
                <div className="z-review__response">
                  <strong>
                    Avis signalé ({report.review.rating}★) sur{' '}
                    <Link href={`/business/${report.review.business.slug}`}>
                      {report.review.business.name}
                    </Link>
                  </strong>
                  <p>{report.review.comment ?? '(sans commentaire)'}</p>
                </div>
              ) : null}

              <p className="z-help">
                Signalé par{' '}
                {report.reporter
                  ? `${report.reporter.firstName} ${report.reporter.lastName} (${report.reporter.email})`
                  : 'un visiteur'}
              </p>

              {report.resolution ? (
                <p className="z-help">Résolution : {report.resolution}</p>
              ) : null}

              {report.status === 'OPEN' || report.status === 'REVIEWING' ? (
                <ReportResolver reportId={report.id} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
