import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { Badge, EmptyState, Panel } from '@/components/ui/Primitives';
import { requireSuperAdmin } from '@/server/auth/guard';
import { RecordPaymentForm } from '@/components/admin/RecordPaymentForm';
import { PlanEditor } from '@/components/admin/PlanEditor';
import {
  intervalDaysFor,
  resolveStatus,
  trialDaysRemaining,
} from '@/domain/monetization/lifecycle';
import { formatDate, formatPrice } from '@/i18n/format';

export const metadata: Metadata = { title: 'Abonnements', robots: { index: false } };

const STATUS_LABEL: Record<string, string> = {
  TRIALING: 'Essai',
  ACTIVE: 'Actif',
  PAST_DUE: 'En retard',
  GRACE: 'Grâce',
  EXPIRED: 'Expiré',
  CANCELLED: 'Résilié',
};

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'accent'> = {
  TRIALING: 'accent',
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  GRACE: 'warning',
  EXPIRED: 'danger',
  CANCELLED: 'neutral',
};

export default async function AdminSubscriptionsPage() {
  await requireSuperAdmin();
  const now = new Date();

  const [subscriptions, plans, recentPayments] = await Promise.all([
    db.subscription.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        plan: true,
        business: {
          select: {
            id: true, name: true, slug: true, status: true,
            owner: { select: { email: true } },
          },
        },
      },
    }),
    db.subscriptionPlan.findMany({ orderBy: { position: 'asc' } }),
    db.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        subscription: { select: { business: { select: { name: true, slug: true } } } },
      },
    }),
  ]);

  // Effective status, not the stored one: a lapsed row the sweep has not yet
  // touched must not read as active here.
  const rows = subscriptions.map((s) => ({
    ...s,
    effective: resolveStatus(s, {
      trialDays: s.plan.trialDays,
      gracePeriodDays: s.plan.gracePeriodDays,
      intervalDays: intervalDaysFor(s.plan.interval),
    }, now),
    trialLeft: trialDaysRemaining(s, now),
  }));

  const grouped = {
    TRIALING: rows.filter((r) => r.effective === 'TRIALING'),
    ACTIVE: rows.filter((r) => r.effective === 'ACTIVE'),
    GRACE: rows.filter((r) => r.effective === 'GRACE' || r.effective === 'PAST_DUE'),
    EXPIRED: rows.filter((r) => r.effective === 'EXPIRED' || r.effective === 'CANCELLED'),
  };

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-6)' }}>
      <h1 className="z-search__title">Abonnements</h1>

      <div className="z-stats">
        <div className="z-stat">
          <span className="z-stat__value">{grouped.TRIALING.length}</span>
          <span className="z-stat__label">En essai</span>
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{grouped.ACTIVE.length}</span>
          <span className="z-stat__label">Payants</span>
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{grouped.GRACE.length}</span>
          <span className="z-stat__label">À relancer</span>
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{grouped.EXPIRED.length}</span>
          <span className="z-stat__label">Expirés / résiliés</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Aucun abonnement" body="Les abonnements apparaîtront ici." />
      ) : (
        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">Tous les abonnements</h2>
          <div className="z-table--scroll">
            <table className="z-table">
              <thead>
                <tr>
                  <th>Établissement</th>
                  <th>Formule</th>
                  <th>Statut</th>
                  <th>Échéance</th>
                  <th>Enregistrer un paiement</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/business/${row.business.slug}`} className="z-ranklist__name">
                        {row.business.name}
                      </Link>
                      <br />
                      <span className="z-help">{row.business.owner.email}</span>
                    </td>
                    <td>
                      {row.plan.name}
                      <br />
                      <span className="z-help">
                        {formatPrice(Number(row.plan.priceAmount), 'fr', row.plan.currency)} /{' '}
                        {row.plan.interval === 'MONTH' ? 'mois' : 'an'}
                      </span>
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[row.effective] ?? 'neutral'}>
                        {STATUS_LABEL[row.effective] ?? row.effective}
                      </Badge>
                      {row.trialLeft !== null ? (
                        <>
                          <br />
                          <span className="z-help">{row.trialLeft} j restants</span>
                        </>
                      ) : null}
                    </td>
                    <td>
                      <span className="z-help">
                        {row.currentEndAt
                          ? formatDate(row.currentEndAt)
                          : row.trialEndAt
                            ? formatDate(row.trialEndAt)
                            : '—'}
                      </span>
                    </td>
                    <td>
                      <RecordPaymentForm
                        businessId={row.businessId}
                        defaultAmount={Number(row.plan.priceAmount)}
                        currency={row.plan.currency}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel className="z-dash__panel">
        <h2 className="z-profile__h3">Derniers paiements</h2>
        {recentPayments.length === 0 ? (
          <p className="z-help">Aucun paiement enregistré.</p>
        ) : (
          <div className="z-table--scroll">
            <table className="z-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Établissement</th>
                  <th>Montant</th>
                  <th>Période</th>
                  <th>Moyen</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.paidAt ? formatDate(payment.paidAt) : '—'}</td>
                    <td>{payment.subscription.business.name}</td>
                    <td>{formatPrice(Number(payment.amount), 'fr', payment.currency)}</td>
                    <td>
                      <span className="z-help">
                        {payment.periodStart && payment.periodEnd
                          ? `${formatDate(payment.periodStart)} → ${formatDate(payment.periodEnd)}`
                          : '—'}
                      </span>
                    </td>
                    <td>
                      <span className="z-help">{payment.provider}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <PlanEditor
        plans={plans.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          description: p.description,
          priceAmount: Number(p.priceAmount),
          currency: p.currency,
          interval: p.interval,
          trialDays: p.trialDays,
          gracePeriodDays: p.gracePeriodDays,
          isActive: p.isActive,
          isDefault: p.isDefault,
        }))}
      />
    </div>
  );
}
