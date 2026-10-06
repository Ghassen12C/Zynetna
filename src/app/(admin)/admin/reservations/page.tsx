import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { requireSuperAdmin } from '@/server/auth/guard';
import { formatDateTime, formatPrice } from '@/i18n/format';

export const metadata: Metadata = { title: 'Réservations', robots: { index: false } };

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmé',
  COMPLETED: 'Terminé',
  CANCELLED_BY_CUSTOMER: 'Annulé (client)',
  CANCELLED_BY_BUSINESS: 'Annulé (établissement)',
  RESCHEDULED: 'Reporté',
  NO_SHOW: 'Absence',
  EXPIRED: 'Expiré',
};

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'accent'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  COMPLETED: 'accent',
  CANCELLED_BY_CUSTOMER: 'danger',
  CANCELLED_BY_BUSINESS: 'danger',
  RESCHEDULED: 'neutral',
  NO_SHOW: 'danger',
  EXPIRED: 'neutral',
};

export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const perPage = 40;

  const where = {
    ...(params.status ? { status: params.status as 'CONFIRMED' } : {}),
    ...(params.q
      ? {
          OR: [
            { reference: { contains: params.q.toUpperCase() } },
            { business: { name: { contains: params.q, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const [rows, total, statusCounts] = await Promise.all([
    db.reservation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        business: { select: { name: true, slug: true, timezone: true } },
        customer: { select: { firstName: true, lastName: true, email: true } },
        staffMember: { select: { displayName: true } },
        items: { select: { serviceName: true } },
      },
    }),
    db.reservation.count({ where }),
    db.reservation.groupBy({ by: ['status'], _count: { status: true } }),
  ]);

  const pageCount = Math.ceil(total / perPage);
  const link = (p: number) =>
    `/admin/reservations?page=${p}${params.status ? `&status=${params.status}` : ''}${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`;

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-5)' }}>
      <h1 className="z-search__title">Réservations ({total})</h1>

      <nav className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
        <Link href="/admin/reservations" className={`z-chip ${!params.status ? 'z-chip--active' : ''}`}>
          Toutes
        </Link>
        {statusCounts.map((s) => (
          <Link
            key={s.status}
            href={`/admin/reservations?status=${s.status}`}
            className={`z-chip ${params.status === s.status ? 'z-chip--active' : ''}`}
          >
            {STATUS_LABEL[s.status] ?? s.status} ({s._count.status})
          </Link>
        ))}
      </nav>

      <form className="z-row" style={{ gap: 'var(--z-space-2)' }}>
        <input
          className="z-input"
          style={{ width: 'auto', minWidth: 240 }}
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Référence (ZY-…) ou établissement"
          aria-label="Rechercher"
        />
        <button type="submit" className="z-btn z-btn--secondary z-btn--md">
          Rechercher
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="Aucune réservation" body="Aucun résultat pour ce filtre." />
      ) : (
        <>
          <div className="z-table--scroll">
            <table className="z-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Établissement</th>
                  <th>Client</th>
                  <th>Prestation</th>
                  <th>Quand</th>
                  <th>Statut</th>
                  <th>Montant</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/reservations/${row.reference}`} className="z-ranklist__name">
                        {row.reference}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/business/${row.business.slug}`}>{row.business.name}</Link>
                    </td>
                    <td>
                      {row.customer
                        ? `${row.customer.firstName} ${row.customer.lastName}`
                        : (row.guestName ?? '—')}
                      <br />
                      <span className="z-help">{row.customer?.email ?? row.guestEmail ?? ''}</span>
                    </td>
                    <td>
                      {row.items[0]?.serviceName ?? '—'}
                      <br />
                      <span className="z-help">{row.staffMember.displayName}</span>
                    </td>
                    <td>
                      <span className="z-help">
                        {formatDateTime(row.startAt, 'fr', row.business.timezone)}
                      </span>
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </Badge>
                    </td>
                    <td>{formatPrice(Number(row.totalAmount), 'fr', row.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 ? (
            <nav className="z-pagination" aria-label="Pagination">
              {page > 1 ? (
                <a className="z-btn z-btn--secondary z-btn--sm" href={link(page - 1)}>
                  ← Précédent
                </a>
              ) : null}
              <span className="z-pagination__state">
                Page {page} sur {pageCount}
              </span>
              {page < pageCount ? (
                <a className="z-btn z-btn--secondary z-btn--sm" href={link(page + 1)}>
                  Suivant →
                </a>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
