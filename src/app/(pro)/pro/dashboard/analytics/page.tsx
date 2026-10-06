import type { Metadata } from 'next';
import { Panel } from '@/components/ui/Primitives';
import { BarList, TrendChart } from '@/components/charts/Charts';
import { proContext } from '@/components/pro/ProGuard';
import { businessHeader, bookingTrend, overviewMetrics } from '@/server/services/proDashboard';
import { formatPrice } from '@/i18n/format';

export const metadata: Metadata = { title: 'Statistiques', robots: { index: false } };

export default async function AnalyticsPage() {
  const { businessId } = await proContext('business.analytics.read', '/pro/dashboard/analytics');
  const business = await businessHeader(businessId);

  const [metrics, trend90] = await Promise.all([
    overviewMetrics(businessId, business.timezone),
    bookingTrend(businessId, 90),
  ]);

  const money = (n: number) => formatPrice(n, 'fr', business.currency);

  return (
    <div className="z-dash">
      <div className="z-stats">
        <div className="z-stat">
          <span className="z-stat__value">{money(metrics.monthRevenue)}</span>
          <span className="z-stat__label">Chiffre du mois</span>
          {metrics.monthDelta !== null ? (
            <span
              className={`z-stat__delta ${metrics.monthDelta >= 0 ? 'z-stat__delta--up' : 'z-stat__delta--down'}`}
            >
              {metrics.monthDelta >= 0 ? '▲' : '▼'} {Math.abs(metrics.monthDelta)} %
            </span>
          ) : null}
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{metrics.totalCustomers}</span>
          <span className="z-stat__label">Clients au total</span>
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{metrics.cancellationRate} %</span>
          <span className="z-stat__label">Taux d’annulation (30 j)</span>
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{metrics.noShowRate} %</span>
          <span className="z-stat__label">Taux d’absence (30 j)</span>
        </div>
      </div>

      <Panel className="z-dash__panel">
        <h2 className="z-profile__h3">Réservations — 90 jours</h2>
        <TrendChart
          label="Réservations par jour sur 90 jours"
          points={trend90.map((t) => ({ label: t.day.slice(5), value: t.count }))}
        />
      </Panel>

      <Panel className="z-dash__panel">
        <h2 className="z-profile__h3">Chiffre d’affaires — 90 jours</h2>
        <TrendChart
          label="Chiffre d’affaires par jour sur 90 jours"
          points={trend90.map((t) => ({ label: t.day.slice(5), value: t.revenue }))}
          format={(n) => `${n}`}
        />
      </Panel>

      <div className="z-dash__grid">
        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">Prestations — volume</h2>
          <BarList points={metrics.topServices.map((s) => ({ label: s.name, value: s.count }))} />
        </Panel>

        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">Prestations — revenus</h2>
          <BarList
            points={metrics.topServices.map((s) => ({ label: s.name, value: s.revenue }))}
            format={(n) => money(n)}
          />
        </Panel>

        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">Équipe</h2>
          <BarList points={metrics.topStaff.map((s) => ({ label: s.name, value: s.count }))} />
        </Panel>

        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">Fidélisation</h2>
          <BarList
            points={[
              { label: 'Clients fidèles', value: metrics.returningCustomers },
              { label: 'Nouveaux clients', value: metrics.newCustomers },
            ]}
          />
          <p className="z-policy">
            Un client est « fidèle » dès son deuxième rendez-vous honoré chez vous.
          </p>
        </Panel>
      </div>
    </div>
  );
}
