import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Panel, EmptyState } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import { BarList, TrendChart } from '@/components/charts/Charts';
import { getActor } from '@/server/auth/session';
import { can } from '@/domain/identity/actor';
import { PRO_HOME_FALLBACK } from '@/domain/identity/proNav';
import { primaryBusinessId, requireBusinessAccess } from '@/server/auth/guard';
import {
  businessHeader,
  bookingTrend,
  overviewMetrics,
  reservationsFor,
} from '@/server/services/proDashboard';
import { Arrow } from '@/components/ui/Arrow';
import { formatDate, formatNumber, formatPrice, formatTime } from '@/i18n/format';
import { translate } from '@/i18n/server';
import { dayKeyOf, instantAt } from '@/domain/scheduling/time';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.dash.nav.overview, robots: { index: false } };
}

export default async function ProOverviewPage() {
  const { m, locale, t, path } = await translate();
  const actor = await getActor();
  if (!actor) redirect(path('/login?redirectTo=/pro/dashboard'));
  const id = await primaryBusinessId(actor);
  if (!id) redirect(path('/pro/onboarding'));

  /**
   * This overview is a revenue dashboard, which an employee has no business
   * reading. Their work is the calendar, so send them there rather than
   * answering their own landing page with "access denied".
   */
  if (!can(actor, 'business.analytics.read', { businessId: id })) {
    redirect(path(PRO_HOME_FALLBACK));
  }

  // Even though the layout resolved the business, the page re-checks the
  // permission: every data read is guarded, not just the entry point.
  const { businessId } = await requireBusinessAccess(id, 'business.analytics.read');
  const business = await businessHeader(businessId);

  const today = dayKeyOf(business.timezone, new Date());
  const [metrics, trend, todayList] = await Promise.all([
    overviewMetrics(businessId, business.timezone),
    bookingTrend(businessId, 30),
    reservationsFor(businessId, {
      from: instantAt(business.timezone, today, 0),
      to: instantAt(business.timezone, today, 1440),
      take: 12,
    }),
  ]);

  const d = m.dash.overview;
  const money = (n: number) => formatPrice(n, locale, business.currency);
  const count = (n: number) => formatNumber(n, locale);
  const percent = (n: number) => t(m.dash.shared.percent, { value: formatNumber(n, locale) });
  const needsSetup = business._count.services === 0 || business._count.staff === 0;

  // What needs doing today comes first: finishing the setup if anything is
  // missing, then today's appointments; the trends and rankings follow.
  return (
    <div className="z-dash">
      {needsSetup ? (
        <Panel className="z-dash__panel">
          <h2>{d.setupTitle}</h2>
          <p className="z-policy">{d.setupBody}</p>
          <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
            {business._count.services === 0 ? (
              <ButtonLink href={path('/pro/dashboard/services')}>{d.addServices}</ButtonLink>
            ) : null}
            {business._count.staff === 0 ? (
              <ButtonLink href={path('/pro/dashboard/team')} variant="secondary">
                {d.addTeam}
              </ButtonLink>
            ) : null}
          </div>
        </Panel>
      ) : null}

      <div className="z-stats" data-reveal="stagger">
        <div className="z-stat">
          <span className="z-stat__value">{count(metrics.todayAppointments)}</span>
          <span className="z-stat__label">{d.todayAppointments}</span>
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{count(metrics.upcoming)}</span>
          <span className="z-stat__label">{d.upcoming}</span>
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{money(metrics.todayRevenue)}</span>
          <span className="z-stat__label">{d.todayRevenue}</span>
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{money(metrics.monthRevenue)}</span>
          <span className="z-stat__label">{d.monthRevenue}</span>
          {metrics.monthDelta !== null ? (
            <span
              className={`z-stat__delta ${metrics.monthDelta >= 0 ? 'z-stat__delta--up' : 'z-stat__delta--down'}`}
            >
              <span aria-hidden="true">{metrics.monthDelta >= 0 ? '▲' : '▼'}</span>{' '}
              {t(m.dash.shared.monthDelta, {
                value: formatNumber(Math.abs(metrics.monthDelta), locale),
              })}
            </span>
          ) : null}
        </div>
      </div>

      <Panel className="z-dash__panel">
        <div className="z-dash__panel-head">
          <h2>{d.todayTitle}</h2>
          <Link href={path('/pro/dashboard/calendar')}>
            {d.openCalendar} <Arrow />
          </Link>
        </div>
        {todayList.rows.length === 0 ? (
          <EmptyState
            title={d.emptyTodayTitle}
            body={d.emptyTodayBody}
            action={
              business._count.services > 0 && business._count.staff > 0 ? (
                <ButtonLink href={path('/pro/dashboard/reservations/new')} size="sm">
                  + {m.dash.shared.newAppointment}
                </ButtonLink>
              ) : null
            }
          />
        ) : (
          <ul className="z-today">
            {todayList.rows.map((reservation) => (
              <li key={reservation.id}>
                <span className="z-today__time">
                  {formatTime(reservation.startAt, locale, business.timezone)}
                </span>
                <span className="z-today__body">
                  <strong>
                    {reservation.customer
                      ? `${reservation.customer.firstName} ${reservation.customer.lastName}`
                      : (reservation.guestName ?? m.dash.shared.guest)}
                  </strong>
                  <span>
                    {reservation.items[0]?.serviceName} · {reservation.staffMember.displayName}
                  </span>
                </span>
                <span className={`z-today__status is-${reservation.status.toLowerCase()}`}>
                  {m.status[reservation.status as keyof typeof m.status] ?? reservation.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="z-dash__panel">
        <div className="z-dash__panel-head">
          <h2>{d.trendTitle}</h2>
          <Link href={path('/pro/dashboard/analytics')}>
            {d.detailedStats} <Arrow />
          </Link>
        </div>
        <TrendChart
          label={d.trendAria}
          emptyLabel={m.dash.shared.noData}
          format={count}
          points={trend.map((p) => ({
            label: formatDate(new Date(`${p.day}T12:00:00Z`), locale, { day: 'numeric' }, 'UTC'),
            value: p.count,
          }))}
        />
      </Panel>

      <div className="z-dash__grid" data-reveal="stagger">
        <Panel className="z-dash__panel">
          <div className="z-dash__panel-head">
            <h2>{d.topServices}</h2>
          </div>
          <BarList
            points={metrics.topServices.map((s) => ({ label: s.name, value: s.count }))}
            format={count}
            emptyLabel={d.noBookings30}
          />
        </Panel>

        <Panel className="z-dash__panel">
          <div className="z-dash__panel-head">
            <h2>{d.topStaff}</h2>
            <Link href={path('/pro/dashboard/team')}>
              {d.manageTeam} <Arrow />
            </Link>
          </div>
          <BarList
            points={metrics.topStaff.map((s) => ({ label: s.name, value: s.count }))}
            format={count}
            emptyLabel={d.noBookings30}
          />
        </Panel>

        <Panel className="z-dash__panel">
          <div className="z-dash__panel-head">
            <h2>{d.clientele}</h2>
            <Link href={path('/pro/dashboard/customers')}>
              {d.seeAllCustomers} <Arrow />
            </Link>
          </div>
          <dl className="z-kv">
            <div>
              <dt>{d.totalCustomers}</dt>
              <dd>{count(metrics.totalCustomers)}</dd>
            </div>
            <div>
              <dt>{d.returningCustomers}</dt>
              <dd>{count(metrics.returningCustomers)}</dd>
            </div>
            <div>
              <dt>{d.newCustomers}</dt>
              <dd>{count(metrics.newCustomers)}</dd>
            </div>
            <div>
              <dt>{d.cancellationRate}</dt>
              <dd>{percent(metrics.cancellationRate)}</dd>
            </div>
            <div>
              <dt>{d.noShowRate}</dt>
              <dd>{percent(metrics.noShowRate)}</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
