import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { Arrow } from '@/components/ui/Arrow';
import { requireSuperAdmin } from '@/server/auth/guard';
import { translate } from '@/i18n/server';
import { formatDateTime, formatNumber, formatPrice } from '@/i18n/format';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.admin.nav.reservations, robots: { index: false } };
}

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
  const { m, locale, t, path } = await translate();
  const c = m.admin.common;
  const r = m.admin.reservations;
  const statusLabel = (status: string) => m.status[status as keyof typeof m.status] ?? status;
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
    `${path('/admin/reservations')}?page=${p}${params.status ? `&status=${params.status}` : ''}${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`;

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-5)' }}>
      <h1 className="z-search__title">
        {t(c.headingCount, { title: m.admin.nav.reservations, count: formatNumber(total, locale) })}
      </h1>

      <nav
        className="z-row"
        style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}
        aria-label={c.filterByStatus}
      >
        <Link
          href={path('/admin/reservations')}
          className={`z-chip ${!params.status ? 'z-chip--active' : ''}`}
        >
          {c.allFeminine}
        </Link>
        {statusCounts.map((s) => (
          <Link
            key={s.status}
            href={`${path('/admin/reservations')}?status=${s.status}`}
            className={`z-chip ${params.status === s.status ? 'z-chip--active' : ''}`}
          >
            {t(c.chipCount, {
              label: statusLabel(s.status),
              count: formatNumber(s._count.status, locale),
            })}
          </Link>
        ))}
      </nav>

      <form className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
        <input
          className="z-input"
          style={{ width: 'auto', minWidth: 240 }}
          name="q"
          defaultValue={params.q ?? ''}
          placeholder={r.searchPlaceholder}
          aria-label={c.search}
        />
        <button type="submit" className="z-btn z-btn--secondary z-btn--md">
          {c.search}
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title={r.empty} body={c.noResult} />
      ) : (
        <>
          <div className="z-table--scroll">
            <table className="z-table">
              <thead>
                <tr>
                  <th>{r.reference}</th>
                  <th>{c.business}</th>
                  <th>{c.customer}</th>
                  <th>{r.service}</th>
                  <th>{r.when}</th>
                  <th>{c.status}</th>
                  <th>{c.amount}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link
                        href={path(`/reservations/${row.reference}`)}
                        className="z-ranklist__name"
                        dir="ltr"
                      >
                        {row.reference}
                      </Link>
                    </td>
                    <td>
                      <Link href={path(`/business/${row.business.slug}`)}>{row.business.name}</Link>
                    </td>
                    <td>
                      {row.customer
                        ? `${row.customer.firstName} ${row.customer.lastName}`
                        : (row.guestName ?? '—')}
                      <br />
                      <span className="z-help" dir="ltr">
                        {row.customer?.email ?? row.guestEmail ?? ''}
                      </span>
                    </td>
                    <td>
                      {row.items[0]?.serviceName ?? '—'}
                      <br />
                      <span className="z-help">{row.staffMember.displayName}</span>
                    </td>
                    <td>
                      <span className="z-help">
                        {formatDateTime(row.startAt, locale, row.business.timezone)}
                      </span>
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>
                        {statusLabel(row.status)}
                      </Badge>
                      <br />
                      <span className="z-help">
                        {t(r.channel, {
                          channel: m.labels.channel[row.channel] ?? row.channel,
                        })}
                      </span>
                    </td>
                    <td>{formatPrice(Number(row.totalAmount), locale, row.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 ? (
            <nav className="z-pagination" aria-label={c.pagination}>
              {page > 1 ? (
                <a className="z-btn z-btn--secondary z-btn--sm" href={link(page - 1)}>
                  <Arrow to="back" /> {m.common.previous}
                </a>
              ) : null}
              <span className="z-pagination__state">
                {t(c.pageState, {
                  page: formatNumber(page, locale),
                  total: formatNumber(pageCount, locale),
                })}
              </span>
              {page < pageCount ? (
                <a className="z-btn z-btn--secondary z-btn--sm" href={link(page + 1)}>
                  {m.common.next} <Arrow />
                </a>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
