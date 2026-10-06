import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Panel, EmptyState } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import { BarList, TrendChart } from '@/components/charts/Charts';
import { getActor } from '@/server/auth/session';
import { primaryBusinessId, requireBusinessAccess } from '@/server/auth/guard';
import {
  businessHeader,
  bookingTrend,
  overviewMetrics,
  reservationsFor,
} from '@/server/services/proDashboard';
import { formatPrice, formatTime } from '@/i18n/format';
import { dayKeyOf, instantAt } from '@/domain/scheduling/time';

export const metadata: Metadata = { title: 'Vue d’ensemble', robots: { index: false } };

export default async function ProOverviewPage() {
  const actor = await getActor();
  if (!actor) redirect('/login?redirectTo=/pro/dashboard');
  const id = await primaryBusinessId(actor);
  if (!id) redirect('/pro/onboarding');

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

  const money = (n: number) => formatPrice(n, 'fr', business.currency);

  return (
    <div className="z-dash">
      <div className="z-stats">
        <div className="z-stat">
          <span className="z-stat__value">{metrics.todayAppointments}</span>
          <span className="z-stat__label">Rendez-vous aujourd’hui</span>
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{money(metrics.todayRevenue)}</span>
          <span className="z-stat__label">Chiffre du jour</span>
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{money(metrics.monthRevenue)}</span>
          <span className="z-stat__label">Chiffre du mois</span>
          {metrics.monthDelta !== null ? (
            <span
              className={`z-stat__delta ${metrics.monthDelta >= 0 ? 'z-stat__delta--up' : 'z-stat__delta--down'}`}
            >
              {metrics.monthDelta >= 0 ? '▲' : '▼'} {Math.abs(metrics.monthDelta)} % vs mois dernier
            </span>
          ) : null}
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{metrics.upcoming}</span>
          <span className="z-stat__label">Rendez-vous à venir</span>
        </div>
      </div>

      <Panel className="z-dash__panel">
        <div className="z-dash__panel-head">
          <h2>Réservations — 30 derniers jours</h2>
          <Link href="/pro/dashboard/analytics">Statistiques détaillées →</Link>
        </div>
        <TrendChart
          label="Réservations par jour sur les 30 derniers jours"
          points={trend.map((t) => ({ label: t.day.slice(8), value: t.count }))}
        />
      </Panel>

      <div className="z-dash__grid">
        <Panel className="z-dash__panel">
          <div className="z-dash__panel-head">
            <h2>Aujourd’hui</h2>
            <Link href="/pro/dashboard/calendar">Agenda →</Link>
          </div>
          {todayList.rows.length === 0 ? (
            <EmptyState
              title="Aucun rendez-vous aujourd’hui"
              body="Les réservations du jour apparaîtront ici dès qu’un client réserve."
            />
          ) : (
            <ul className="z-today">
              {todayList.rows.map((reservation) => (
                <li key={reservation.id}>
                  <span className="z-today__time">
                    {formatTime(reservation.startAt, 'fr', business.timezone)}
                  </span>
                  <span className="z-today__body">
                    <strong>
                      {reservation.customer
                        ? `${reservation.customer.firstName} ${reservation.customer.lastName}`
                        : (reservation.guestName ?? 'Client')}
                    </strong>
                    <span>
                      {reservation.items[0]?.serviceName} · {reservation.staffMember.displayName}
                    </span>
                  </span>
                  <span className={`z-today__status is-${reservation.status.toLowerCase()}`}>
                    {reservation.status === 'CONFIRMED'
                      ? 'Confirmé'
                      : reservation.status === 'PENDING'
                        ? 'En attente'
                        : reservation.status === 'COMPLETED'
                          ? 'Terminé'
                          : 'Annulé'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="z-dash__panel">
          <div className="z-dash__panel-head">
            <h2>Prestations les plus demandées</h2>
          </div>
          <BarList
            points={metrics.topServices.map((s) => ({ label: s.name, value: s.count }))}
            format={(n) => `${n}`}
            emptyLabel="Aucune réservation sur les 30 derniers jours."
          />
        </Panel>

        <Panel className="z-dash__panel">
          <div className="z-dash__panel-head">
            <h2>Équipe la plus active</h2>
            <Link href="/pro/dashboard/team">Gérer →</Link>
          </div>
          <BarList
            points={metrics.topStaff.map((s) => ({ label: s.name, value: s.count }))}
            emptyLabel="Aucune réservation sur les 30 derniers jours."
          />
        </Panel>

        <Panel className="z-dash__panel">
          <div className="z-dash__panel-head">
            <h2>Clientèle</h2>
            <Link href="/pro/dashboard/customers">Voir tous →</Link>
          </div>
          <dl className="z-kv">
            <div>
              <dt>Clients au total</dt>
              <dd>{metrics.totalCustomers}</dd>
            </div>
            <div>
              <dt>Clients fidèles</dt>
              <dd>{metrics.returningCustomers}</dd>
            </div>
            <div>
              <dt>Nouveaux clients</dt>
              <dd>{metrics.newCustomers}</dd>
            </div>
            <div>
              <dt>Taux d’annulation</dt>
              <dd>{metrics.cancellationRate} %</dd>
            </div>
            <div>
              <dt>Taux d’absence</dt>
              <dd>{metrics.noShowRate} %</dd>
            </div>
          </dl>
        </Panel>
      </div>

      {business._count.services === 0 || business._count.staff === 0 ? (
        <Panel className="z-dash__panel">
          <h2>Finalisez votre établissement</h2>
          <p className="z-policy">
            Il manque encore quelques éléments pour que vos clients puissent réserver.
          </p>
          <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
            {business._count.services === 0 ? (
              <ButtonLink href="/pro/dashboard/services">Ajouter des prestations</ButtonLink>
            ) : null}
            {business._count.staff === 0 ? (
              <ButtonLink href="/pro/dashboard/team" variant="secondary">
                Ajouter votre équipe
              </ButtonLink>
            ) : null}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
