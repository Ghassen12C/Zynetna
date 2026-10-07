import type { Metadata } from 'next';
import { Badge, Panel } from '@/components/ui/Primitives';
import { Alert } from '@/components/ui/Alert';
import { proContext } from '@/components/pro/ProGuard';
import { getSubscriptionView } from '@/server/services/subscriptions';
import { db } from '@/lib/db';
import { formatCount, formatDate, formatPrice } from '@/i18n/format';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.dash.nav.subscription, robots: { index: false } };
}

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

  const [subscription, plans, { m, locale, t }] = await Promise.all([
    getSubscriptionView(businessId),
    db.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { position: 'asc' } }),
    translate(),
  ]);
  const d = m.dash.subscription;

  if (!subscription) {
    return <Alert tone="warning">{d.none}</Alert>;
  }

  const price = formatPrice(
    Number(subscription.plan.priceAmount),
    locale,
    subscription.plan.currency,
  );
  const interval = m.labels.interval[subscription.plan.interval];
  const status = subscription.effectiveStatus as keyof typeof m.labels.subscriptionStatus;

  return (
    <div className="z-dash">
      <Panel className="z-dash__panel">
        <div className="z-dash__panel-head">
          <div>
            <h2 className="z-profile__h3">{subscription.plan.name}</h2>
            <p className="z-policy">{subscription.plan.description}</p>
          </div>
          <Badge tone={STATUS_TONE[subscription.effectiveStatus] ?? 'neutral'}>
            {m.labels.subscriptionStatus[status] ?? subscription.effectiveStatus}
          </Badge>
        </div>

        <dl className="z-kv">
          <div>
            <dt>{d.price}</dt>
            <dd>{t(d.pricePer, { price, interval })}</dd>
          </div>
          {subscription.trialEndAt ? (
            <div>
              <dt>{d.trialEnd}</dt>
              <dd>
                {subscription.trialDaysLeft !== null
                  ? t(d.trialEndValue, {
                      date: formatDate(subscription.trialEndAt, locale),
                      left: formatCount(d.daysLeft, subscription.trialDaysLeft, locale),
                    })
                  : formatDate(subscription.trialEndAt, locale)}
              </dd>
            </div>
          ) : null}
          {subscription.currentEndAt ? (
            <div>
              <dt>{d.currentEnd}</dt>
              <dd>{formatDate(subscription.currentEndAt, locale)}</dd>
            </div>
          ) : null}
          <div>
            <dt>{d.visible}</dt>
            <dd>{subscription.entitled ? m.common.yes : m.common.no}</dd>
          </div>
        </dl>

        {!subscription.entitled ? (
          <Alert tone="error">{d.expiredAlert}</Alert>
        ) : null}

        {subscription.effectiveStatus === 'TRIALING' ? (
          <Alert tone="info">{t(d.trialAlert, { price, interval })}</Alert>
        ) : null}

        <Alert tone="info">{d.paymentNotice}</Alert>
      </Panel>

      <Panel className="z-dash__panel">
        <h2 className="z-profile__h3">{d.paymentsTitle}</h2>
        {subscription.payments.length === 0 ? (
          <p className="z-help">{d.noPayments}</p>
        ) : (
          <div className="z-table--scroll">
            <table className="z-table">
              <thead>
                <tr>
                  <th>{d.colDate}</th>
                  <th>{d.colAmount}</th>
                  <th>{d.colPeriod}</th>
                  <th>{d.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {subscription.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.paidAt ? formatDate(payment.paidAt, locale) : '—'}</td>
                    <td>{formatPrice(Number(payment.amount), locale, payment.currency)}</td>
                    <td>
                      {payment.periodStart && payment.periodEnd
                        ? t(d.periodRange, {
                            start: formatDate(payment.periodStart, locale),
                            end: formatDate(payment.periodEnd, locale),
                          })
                        : '—'}
                    </td>
                    <td>
                      <Badge tone={payment.status === 'SUCCEEDED' ? 'success' : 'warning'}>
                        {m.labels.paymentStatus[
                          payment.status as keyof typeof m.labels.paymentStatus
                        ] ?? payment.status}
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
        <h2 className="z-profile__h3">{d.plansTitle}</h2>
        <div className="z-grid z-grid--2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`z-plan ${plan.id === subscription.planId ? 'is-current' : ''}`}
            >
              <h3>{plan.name}</h3>
              <p className="z-plan__price">
                {formatPrice(Number(plan.priceAmount), locale, plan.currency)}
                <span> / {m.labels.interval[plan.interval]}</span>
              </p>
              {plan.trialDays > 0 ? (
                <Badge tone="gold">
                  {formatCount(d.monthsFree, Math.round(plan.trialDays / 30), locale)}
                </Badge>
              ) : null}
              {plan.description ? <p className="z-policy">{plan.description}</p> : null}
              {plan.id === subscription.planId ? <Badge tone="accent">{d.currentPlan}</Badge> : null}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
