import type { Metadata } from 'next';
import Link from 'next/link';
import { Panel } from '@/components/ui/Primitives';
import { Arrow } from '@/components/ui/Arrow';
import { BarList, TrendChart } from '@/components/charts/Charts';
import { requireSuperAdmin } from '@/server/auth/guard';
import {
  geographicDistribution,
  platformOverview,
  platformTrend,
  popularCategories,
  topBusinesses,
} from '@/server/services/adminDashboard';
import { db } from '@/lib/db';
import { translate } from '@/i18n/server';
import { formatCount, formatNumber, formatPrice, localizedName } from '@/i18n/format';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.admin.shell.title, robots: { index: false } };
}

export default async function AdminDashboardPage() {
  await requireSuperAdmin();
  const { m, locale, t, path } = await translate();
  const a = m.admin.overview;

  const [overview, trend, geo, categories, top] = await Promise.all([
    platformOverview(),
    platformTrend(30),
    geographicDistribution(),
    popularCategories(),
    topBusinesses(8),
  ]);

  // The dashboard services return the French names; look up the translated
  // ones so an Arabic or English page does not mix languages.
  const [cityNames, categoryNames] = await Promise.all([
    db.city.findMany({
      where: { name: { in: geo.map((g) => g.city) } },
      select: { name: true, nameAr: true },
    }),
    db.category.findMany({
      where: { parentId: null, name: { in: categories.map((c) => c.name) } },
      select: { name: true, nameAr: true, nameEn: true },
    }),
  ]);
  const cityName = (name: string) => {
    const row = cityNames.find((c) => c.name === name);
    return row ? localizedName(row, locale) : name;
  };
  const categoryName = (name: string) => {
    const row = categoryNames.find((c) => c.name === name);
    return row ? localizedName(row, locale) : name;
  };

  const money = (n: number) => formatPrice(n, locale, 'TND');
  const num = (n: number) => formatNumber(n, locale);
  const percent = (n: number) => t(m.admin.common.percent, { value: num(n) });

  return (
    <div className="z-dash">
      <div>
        <h1 className="z-search__title">{m.admin.nav.overview}</h1>
        <p className="z-policy">{a.lead}</p>
      </div>

      <section>
        <h2 className="z-profile__h3">{a.marketplace}</h2>
        <div className="z-stats">
          <div className="z-stat">
            <span className="z-stat__value">{num(overview.users.total)}</span>
            <span className="z-stat__label">{a.users}</span>
            <span className="z-stat__delta z-stat__delta--up">
              {t(a.newUsers, { count: num(overview.users.new30) })}
            </span>
          </div>
          <div className="z-stat">
            <span className="z-stat__value">{num(overview.businesses.active)}</span>
            <span className="z-stat__label">{a.activeBusinesses}</span>
            {overview.businesses.pending > 0 ? (
              <span className="z-stat__delta z-stat__delta--down">
                {t(a.pendingBusinesses, { count: num(overview.businesses.pending) })}
              </span>
            ) : null}
          </div>
          <div className="z-stat">
            <span className="z-stat__value">{num(overview.reservations.total)}</span>
            <span className="z-stat__label">{a.totalReservations}</span>
            <span className="z-stat__delta z-stat__delta--up">
              {t(a.thisWeek, { count: num(overview.reservations.week) })}
            </span>
          </div>
          <div className="z-stat">
            <span className="z-stat__value">{money(overview.reservations.gmvMonth)}</span>
            <span className="z-stat__label">{a.gmvMonth}</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="z-profile__h3">{a.subscriptions}</h2>
        <div className="z-stats">
          <div className="z-stat">
            <span className="z-stat__value">{money(overview.subscriptions.mrr)}</span>
            <span className="z-stat__label">{a.mrr}</span>
          </div>
          <div className="z-stat">
            <span className="z-stat__value">{num(overview.subscriptions.trialing)}</span>
            <span className="z-stat__label">{a.trialing}</span>
          </div>
          <div className="z-stat">
            <span className="z-stat__value">{num(overview.subscriptions.active)}</span>
            <span className="z-stat__label">{a.paying}</span>
          </div>
          <div className="z-stat">
            <span className="z-stat__value">{percent(overview.subscriptions.conversionRate)}</span>
            <span className="z-stat__label">{a.conversion}</span>
          </div>
          <div className="z-stat">
            <span className="z-stat__value">{percent(overview.subscriptions.churnRate)}</span>
            <span className="z-stat__label">{a.churn}</span>
          </div>
          <div className="z-stat">
            <span className="z-stat__value">{num(overview.subscriptions.expired)}</span>
            <span className="z-stat__label">{a.expired}</span>
          </div>
        </div>
      </section>

      <div className="z-dash__grid">
        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">{a.signups30}</h2>
          <TrendChart
            label={a.signupsChart}
            emptyLabel={a.noData}
            format={num}
            points={trend.users.map((p) => ({ label: p.day.slice(8), value: p.count }))}
          />
        </Panel>

        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">{a.reservations30}</h2>
          <TrendChart
            label={a.reservationsChart}
            emptyLabel={a.noData}
            format={num}
            points={trend.reservations.map((p) => ({ label: p.day.slice(8), value: p.count }))}
          />
        </Panel>

        <Panel className="z-dash__panel">
          <div className="z-dash__panel-head">
            <h2 className="z-profile__h3">{a.topCities}</h2>
          </div>
          <BarList
            points={geo.slice(0, 8).map((g) => ({
              label: t(a.cityPoint, { city: cityName(g.city), count: num(g.businesses) }),
              value: g.reservations,
            }))}
            format={num}
            emptyLabel={a.noGeo}
          />
        </Panel>

        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">{a.topCategories}</h2>
          <BarList
            points={categories.map((c) => ({ label: categoryName(c.name), value: c.reservations }))}
            format={num}
            emptyLabel={a.noData}
          />
        </Panel>

        <Panel className="z-dash__panel">
          <div className="z-dash__panel-head">
            <h2 className="z-profile__h3">{a.topBusinesses}</h2>
            <Link href={path('/admin/businesses')}>
              {m.common.seeAll} <Arrow />
            </Link>
          </div>
          <ul className="z-ranklist">
            {top.map((business, index) => (
              <li key={business.id}>
                <span className="z-ranklist__rank">{num(index + 1)}</span>
                <Link href={path(`/business/${business.slug}`)} className="z-ranklist__name">
                  {business.name}
                </Link>
                <span className="z-ranklist__value">
                  {formatCount(m.admin.common.reservationsCount, business.reservations, locale)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">{a.operations30}</h2>
          <dl className="z-kv">
            <div>
              <dt>{a.cancelledNoShow}</dt>
              <dd>{num(overview.reservations.cancelled30)}</dd>
            </div>
            <div>
              <dt>{a.activeUsers}</dt>
              <dd>{num(overview.users.active30)}</dd>
            </div>
            <div>
              <dt>{a.suspendedBusinesses}</dt>
              <dd>{num(overview.businesses.suspended)}</dd>
            </div>
            <div>
              <dt>{a.paymentsRecorded}</dt>
              <dd>
                {t(a.paymentsValue, {
                  amount: money(overview.subscriptions.revenue30),
                  payments: formatCount(
                    a.paymentsCount,
                    overview.subscriptions.payments30,
                    locale,
                  ),
                })}
              </dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
