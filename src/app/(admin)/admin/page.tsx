import type { Metadata } from 'next';
import Link from 'next/link';
import { Panel } from '@/components/ui/Primitives';
import { BarList, TrendChart } from '@/components/charts/Charts';
import { requireSuperAdmin } from '@/server/auth/guard';
import {
  geographicDistribution,
  platformOverview,
  platformTrend,
  popularCategories,
  topBusinesses,
} from '@/server/services/adminDashboard';
import { formatPrice } from '@/i18n/format';

export const metadata: Metadata = { title: 'Administration', robots: { index: false } };

export default async function AdminDashboardPage() {
  await requireSuperAdmin();

  const [overview, trend, geo, categories, top] = await Promise.all([
    platformOverview(),
    platformTrend(30),
    geographicDistribution(),
    popularCategories(),
    topBusinesses(8),
  ]);

  const money = (n: number) => formatPrice(n, 'fr', 'TND');

  return (
    <div className="z-dash">
      <h1 className="z-search__title">Tableau de bord</h1>

      <section>
        <h2 className="z-profile__h3">Marketplace</h2>
        <div className="z-stats">
          <div className="z-stat">
            <span className="z-stat__value">{overview.users.total}</span>
            <span className="z-stat__label">Utilisateurs</span>
            <span className="z-stat__delta z-stat__delta--up">
              +{overview.users.new30} ce mois
            </span>
          </div>
          <div className="z-stat">
            <span className="z-stat__value">{overview.businesses.active}</span>
            <span className="z-stat__label">Établissements en ligne</span>
            {overview.businesses.pending > 0 ? (
              <span className="z-stat__delta z-stat__delta--down">
                {overview.businesses.pending} en attente
              </span>
            ) : null}
          </div>
          <div className="z-stat">
            <span className="z-stat__value">{overview.reservations.total}</span>
            <span className="z-stat__label">Réservations au total</span>
            <span className="z-stat__delta z-stat__delta--up">
              {overview.reservations.week} cette semaine
            </span>
          </div>
          <div className="z-stat">
            <span className="z-stat__value">{money(overview.reservations.gmvMonth)}</span>
            <span className="z-stat__label">Volume d’affaires du mois</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="z-profile__h3">Abonnements</h2>
        <div className="z-stats">
          <div className="z-stat">
            <span className="z-stat__value">{money(overview.subscriptions.mrr)}</span>
            <span className="z-stat__label">Revenu mensuel récurrent</span>
          </div>
          <div className="z-stat">
            <span className="z-stat__value">{overview.subscriptions.trialing}</span>
            <span className="z-stat__label">En essai gratuit</span>
          </div>
          <div className="z-stat">
            <span className="z-stat__value">{overview.subscriptions.active}</span>
            <span className="z-stat__label">Abonnés payants</span>
          </div>
          <div className="z-stat">
            <span className="z-stat__value">{overview.subscriptions.conversionRate} %</span>
            <span className="z-stat__label">Taux de conversion</span>
          </div>
          <div className="z-stat">
            <span className="z-stat__value">{overview.subscriptions.churnRate} %</span>
            <span className="z-stat__label">Taux d’attrition</span>
          </div>
          <div className="z-stat">
            <span className="z-stat__value">{overview.subscriptions.expired}</span>
            <span className="z-stat__label">Expirés</span>
          </div>
        </div>
      </section>

      <div className="z-dash__grid">
        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">Inscriptions — 30 jours</h2>
          <TrendChart
            label="Nouveaux utilisateurs par jour"
            points={trend.users.map((t) => ({ label: t.day.slice(8), value: t.count }))}
          />
        </Panel>

        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">Réservations — 30 jours</h2>
          <TrendChart
            label="Réservations créées par jour"
            points={trend.reservations.map((t) => ({ label: t.day.slice(8), value: t.count }))}
          />
        </Panel>

        <Panel className="z-dash__panel">
          <div className="z-dash__panel-head">
            <h2 className="z-profile__h3">Villes les plus actives</h2>
          </div>
          <BarList
            points={geo.slice(0, 8).map((g) => ({
              label: `${g.city} (${g.businesses})`,
              value: g.reservations,
            }))}
            emptyLabel="Aucune activité géolocalisée."
          />
        </Panel>

        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">Catégories populaires</h2>
          <BarList
            points={categories.map((c) => ({ label: c.name, value: c.reservations }))}
          />
        </Panel>

        <Panel className="z-dash__panel">
          <div className="z-dash__panel-head">
            <h2 className="z-profile__h3">Établissements les plus réservés</h2>
            <Link href="/admin/businesses">Tous →</Link>
          </div>
          <ul className="z-ranklist">
            {top.map((business, index) => (
              <li key={business.id}>
                <span className="z-ranklist__rank">{index + 1}</span>
                <Link href={`/business/${business.slug}`} className="z-ranklist__name">
                  {business.name}
                </Link>
                <span className="z-ranklist__value">{business.reservations} RDV</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">Opérations — 30 jours</h2>
          <dl className="z-kv">
            <div>
              <dt>Réservations annulées / absences</dt>
              <dd>{overview.reservations.cancelled30}</dd>
            </div>
            <div>
              <dt>Utilisateurs actifs</dt>
              <dd>{overview.users.active30}</dd>
            </div>
            <div>
              <dt>Établissements suspendus</dt>
              <dd>{overview.businesses.suspended}</dd>
            </div>
            <div>
              <dt>Paiements encaissés</dt>
              <dd>
                {money(overview.subscriptions.revenue30)} ({overview.subscriptions.payments30})
              </dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
