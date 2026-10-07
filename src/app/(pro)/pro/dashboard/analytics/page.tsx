import type { Metadata } from 'next';
import { Panel } from '@/components/ui/Primitives';
import { BarList, TrendChart } from '@/components/charts/Charts';
import { proContext } from '@/components/pro/ProGuard';
import { businessHeader, bookingTrend, overviewMetrics } from '@/server/services/proDashboard';
import { formatDate, formatNumber, formatPrice } from '@/i18n/format';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.dash.nav.analytics, robots: { index: false } };
}

export default async function AnalyticsPage() {
  const { businessId } = await proContext('business.analytics.read', '/pro/dashboard/analytics');
  const [business, { m, locale, t }] = await Promise.all([
    businessHeader(businessId),
    translate(),
  ]);

  const [metrics, trend90] = await Promise.all([
    overviewMetrics(businessId, business.timezone),
    bookingTrend(businessId, 90),
  ]);

  const d = m.dash.analytics;
  const o = m.dash.overview;
  const money = (n: number) => formatPrice(n, locale, business.currency);
  const count = (n: number) => formatNumber(n, locale);
  const percent = (n: number) => t(m.dash.shared.percent, { value: formatNumber(n, locale) });
  // Day keys are calendar dates: format them at noon UTC so no zone shifts them.
  const tick = (day: string) =>
    formatDate(new Date(`${day}T12:00:00Z`), locale, { day: 'numeric', month: 'short' }, 'UTC');

  return (
    <div className="z-dash">
      <div className="z-stats">
        <div className="z-stat">
          <span className="z-stat__value">{money(metrics.monthRevenue)}</span>
          <span className="z-stat__label">{o.monthRevenue}</span>
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
        <div className="z-stat">
          <span className="z-stat__value">{count(metrics.totalCustomers)}</span>
          <span className="z-stat__label">{d.totalCustomers}</span>
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{percent(metrics.cancellationRate)}</span>
          <span className="z-stat__label">{d.cancellationRate30}</span>
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{percent(metrics.noShowRate)}</span>
          <span className="z-stat__label">{d.noShowRate30}</span>
        </div>
      </div>

      <Panel className="z-dash__panel">
        <h2 className="z-profile__h3">{d.bookings90}</h2>
        <TrendChart
          label={d.bookings90Aria}
          emptyLabel={m.dash.shared.noData}
          format={count}
          points={trend90.map((p) => ({ label: tick(p.day), value: p.count }))}
        />
      </Panel>

      <Panel className="z-dash__panel">
        <h2 className="z-profile__h3">{d.revenue90}</h2>
        <TrendChart
          label={d.revenue90Aria}
          emptyLabel={m.dash.shared.noData}
          points={trend90.map((p) => ({ label: tick(p.day), value: p.revenue }))}
          format={count}
        />
      </Panel>

      <div className="z-dash__grid">
        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">{d.servicesVolume}</h2>
          <BarList
            points={metrics.topServices.map((s) => ({ label: s.name, value: s.count }))}
            format={count}
            emptyLabel={m.dash.shared.noData}
          />
        </Panel>

        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">{d.servicesRevenue}</h2>
          <BarList
            points={metrics.topServices.map((s) => ({ label: s.name, value: s.revenue }))}
            format={(n) => money(n)}
            emptyLabel={m.dash.shared.noData}
          />
        </Panel>

        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">{d.team}</h2>
          <BarList
            points={metrics.topStaff.map((s) => ({ label: s.name, value: s.count }))}
            format={count}
            emptyLabel={m.dash.shared.noData}
          />
        </Panel>

        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">{d.loyalty}</h2>
          <BarList
            points={[
              { label: o.returningCustomers, value: metrics.returningCustomers },
              { label: o.newCustomers, value: metrics.newCustomers },
            ]}
            format={count}
            emptyLabel={m.dash.shared.noData}
          />
          <p className="z-policy">{d.loyaltyNote}</p>
        </Panel>
      </div>
    </div>
  );
}
