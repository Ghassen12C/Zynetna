import type { Metadata } from 'next';
import { Badge, Panel } from '@/components/ui/Primitives';
import { Alert } from '@/components/ui/Alert';
import { proContext } from '@/components/pro/ProGuard';
import { getSubscriptionView } from '@/server/services/subscriptions';
import { db } from '@/lib/db';
import { formatDate, formatPrice } from '@/i18n/format';

export const metadata: Metadata = { title: 'Abonnement', robots: { index: false } };

const STATUS_LABEL: Record<string, string> = {
  TRIALING: 'Essai gratuit',
  ACTIVE: 'Actif',
  PAST_DUE: 'Paiement en retard',
  GRACE: 'Période de grâce',
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

export default async function SubscriptionPage() {
  const { businessId } = await proContext('business.subscription.read', '/pro/dashboard/subscription');

  const [subscription, plans] = await Promise.all([
    getSubscriptionView(businessId),
    db.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { position: 'asc' } }),
  ]);

  if (!subscription) {
    return <Alert tone="warning">Aucun abonnement associé à cet établissement.</Alert>;
  }

  const price = formatPrice(
    Number(subscription.plan.priceAmount),
    'fr',
    subscription.plan.currency,
  );

  return (
    <div className="z-dash">
      <Panel className="z-dash__panel">
        <div className="z-dash__panel-head">
          <div>
            <h2 className="z-profile__h3">{subscription.plan.name}</h2>
            <p className="z-policy">{subscription.plan.description}</p>
          </div>
          <Badge tone={STATUS_TONE[subscription.effectiveStatus] ?? 'neutral'}>
            {STATUS_LABEL[subscription.effectiveStatus] ?? subscription.effectiveStatus}
          </Badge>
        </div>

        <dl className="z-kv">
          <div>
            <dt>Tarif</dt>
            <dd>
              {price} / {subscription.plan.interval === 'MONTH' ? 'mois' : 'an'}
            </dd>
          </div>
          {subscription.trialEndAt ? (
            <div>
              <dt>Fin de l’essai</dt>
              <dd>
                {formatDate(subscription.trialEndAt)}
                {subscription.trialDaysLeft !== null
                  ? ` (${subscription.trialDaysLeft} j restants)`
                  : ''}
              </dd>
            </div>
          ) : null}
          {subscription.currentEndAt ? (
            <div>
              <dt>Période en cours jusqu’au</dt>
              <dd>{formatDate(subscription.currentEndAt)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Visible dans les recherches</dt>
            <dd>{subscription.entitled ? 'Oui' : 'Non'}</dd>
          </div>
        </dl>

        {!subscription.entitled ? (
          <Alert tone="error">
            Votre établissement n’apparaît plus dans les recherches et n’accepte plus de nouvelles
            réservations. Les rendez-vous déjà pris sont maintenus. Contactez Zynetna pour
            régulariser votre abonnement.
          </Alert>
        ) : null}

        {subscription.effectiveStatus === 'TRIALING' ? (
          <Alert tone="info">
            Vos deux premiers mois sont offerts. À la fin de l’essai, l’abonnement passe à {price}{' '}
            par mois, sans engagement.
          </Alert>
        ) : null}

        <Alert tone="info">
          Le paiement en ligne n’est pas encore ouvert. Zynetna vous contactera avant la fin de
          votre période pour convenir du règlement.
        </Alert>
      </Panel>

      <Panel className="z-dash__panel">
        <h2 className="z-profile__h3">Historique des paiements</h2>
        {subscription.payments.length === 0 ? (
          <p className="z-help">Aucun paiement enregistré.</p>
        ) : (
          <div className="z-table--scroll">
            <table className="z-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Montant</th>
                  <th>Période</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {subscription.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.paidAt ? formatDate(payment.paidAt) : '—'}</td>
                    <td>{formatPrice(Number(payment.amount), 'fr', payment.currency)}</td>
                    <td>
                      {payment.periodStart && payment.periodEnd
                        ? `${formatDate(payment.periodStart)} → ${formatDate(payment.periodEnd)}`
                        : '—'}
                    </td>
                    <td>
                      <Badge tone={payment.status === 'SUCCEEDED' ? 'success' : 'warning'}>
                        {payment.status === 'SUCCEEDED' ? 'Payé' : payment.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="z-dash__panel">
        <h2 className="z-profile__h3">Formules disponibles</h2>
        <div className="z-grid z-grid--2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`z-plan ${plan.id === subscription.planId ? 'is-current' : ''}`}
            >
              <h3>{plan.name}</h3>
              <p className="z-plan__price">
                {formatPrice(Number(plan.priceAmount), 'fr', plan.currency)}
                <span> / {plan.interval === 'MONTH' ? 'mois' : 'an'}</span>
              </p>
              {plan.trialDays > 0 ? (
                <Badge tone="gold">{Math.round(plan.trialDays / 30)} mois offerts</Badge>
              ) : null}
              {plan.description ? <p className="z-policy">{plan.description}</p> : null}
              {plan.id === subscription.planId ? <Badge tone="accent">Formule actuelle</Badge> : null}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
