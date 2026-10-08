import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { Badge, EmptyState, Panel } from '@/components/ui/Primitives';
import { requireSuperAdmin } from '@/server/auth/guard';
import { RecordPaymentForm } from '@/components/admin/RecordPaymentForm';
import { PlanEditor } from '@/components/admin/PlanEditor';
import { D17Review } from '@/components/payments/D17Review';
import { D17_PROVIDER } from '@/server/services/payments';
import {
  intervalDaysFor,
  resolveStatus,
  trialDaysRemaining,
} from '@/domain/monetization/lifecycle';
import { translate } from '@/i18n/server';
import { formatCount, formatDate, formatNumber, formatPrice } from '@/i18n/format';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.admin.nav.subscriptions, robots: { index: false } };
}

const PAYMENT_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  REFUNDED: 'neutral',
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
  const { m, locale, t, path } = await translate();
  const c = m.admin.common;
  const s = m.admin.subscriptions;
  const now = new Date();

  const [subscriptions, plans, recentPayments, pendingD17] = await Promise.all([
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
    db.payment.findMany({
      where: { provider: D17_PROVIDER, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, amount: true, currency: true, createdAt: true,
        providerRef: true, metadata: true, planId: true,
        subscription: {
          select: {
            business: { select: { name: true, slug: true, owner: { select: { email: true } } } },
          },
        },
      },
    }),
  ]);
  const planName = new Map(plans.map((p) => [p.id, p.name]));
  const d17 = m.admin.d17;

  // Effective status, not the stored one: a lapsed row the sweep has not yet
  // touched must not read as active here.
  const rows = subscriptions.map((sub) => ({
    ...sub,
    effective: resolveStatus(sub, {
      trialDays: sub.plan.trialDays,
      gracePeriodDays: sub.plan.gracePeriodDays,
      intervalDays: intervalDaysFor(sub.plan.interval),
    }, now),
    trialLeft: trialDaysRemaining(sub, now),
  }));

  const grouped = {
    TRIALING: rows.filter((r) => r.effective === 'TRIALING'),
    ACTIVE: rows.filter((r) => r.effective === 'ACTIVE'),
    GRACE: rows.filter((r) => r.effective === 'GRACE' || r.effective === 'PAST_DUE'),
    EXPIRED: rows.filter((r) => r.effective === 'EXPIRED' || r.effective === 'CANCELLED'),
  };

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-6)' }}>
      <div>
        <h1 className="z-search__title">{m.admin.nav.subscriptions}</h1>
        <p className="z-policy">{s.manualNote}</p>
      </div>

      <Panel className="z-dash__panel">
        <div>
          <h2 className="z-profile__h3">
            {d17.pendingTitle} ({formatNumber(pendingD17.length, locale)})
          </h2>
          <p className="z-policy">{d17.pendingLead}</p>
        </div>
        {pendingD17.length === 0 ? (
          <p className="z-help">{d17.none}</p>
        ) : (
          <div className="z-table--scroll">
            <table className="z-table">
              <thead>
                <tr>
                  <th>{d17.colBusiness}</th>
                  <th>{d17.colPlan}</th>
                  <th>{d17.colAmount}</th>
                  <th>{d17.colSent}</th>
                  <th>{d17.colRef}</th>
                  <th>{d17.colProof}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pendingD17.map((payment) => {
                  const meta = (payment.metadata ?? {}) as { reference?: unknown };
                  return (
                    <tr key={payment.id}>
                      <td>
                        {payment.subscription.business.name}
                        <br />
                        <span className="z-help" dir="ltr">
                          {payment.subscription.business.owner.email}
                        </span>
                      </td>
                      <td>{payment.planId ? (planName.get(payment.planId) ?? '—') : '—'}</td>
                      <td>{formatPrice(Number(payment.amount), locale, payment.currency)}</td>
                      <td>
                        <span className="z-help">{formatDate(payment.createdAt, locale)}</span>
                      </td>
                      <td>
                        <bdi dir="ltr" className="z-d17__ref">
                          {typeof meta.reference === 'string' ? meta.reference : '—'}
                        </bdi>
                        {payment.providerRef ? (
                          <>
                            <br />
                            <span className="z-help">
                              {t(d17.transaction, { ref: payment.providerRef })}
                            </span>
                          </>
                        ) : null}
                      </td>
                      <td>
                        <a
                          href={`/api/payments/${payment.id}/proof`}
                          target="_blank"
                          rel="noopener"
                          className="z-btn z-btn--secondary z-btn--sm"
                        >
                          {d17.viewProof}
                        </a>
                      </td>
                      <td>
                        <D17Review paymentId={payment.id} m={{ admin: m.admin, common: m.common }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="z-stats">
        <div className="z-stat">
          <span className="z-stat__value">{formatNumber(grouped.TRIALING.length, locale)}</span>
          <span className="z-stat__label">{s.trialing}</span>
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{formatNumber(grouped.ACTIVE.length, locale)}</span>
          <span className="z-stat__label">{s.paying}</span>
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{formatNumber(grouped.GRACE.length, locale)}</span>
          <span className="z-stat__label">{s.toChase}</span>
        </div>
        <div className="z-stat">
          <span className="z-stat__value">{formatNumber(grouped.EXPIRED.length, locale)}</span>
          <span className="z-stat__label">{s.ended}</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={s.empty} body={s.emptyBody} />
      ) : (
        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">{s.all}</h2>
          <div className="z-table--scroll">
            <table className="z-table">
              <thead>
                <tr>
                  <th>{c.business}</th>
                  <th>{s.plan}</th>
                  <th>{c.status}</th>
                  <th>{s.due}</th>
                  <th>{s.recordPayment}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link
                        href={path(`/business/${row.business.slug}`)}
                        className="z-ranklist__name"
                      >
                        {row.business.name}
                      </Link>
                      <br />
                      <span className="z-help" dir="ltr">
                        {row.business.owner.email}
                      </span>
                    </td>
                    <td>
                      {row.plan.name}
                      <br />
                      <span className="z-help">
                        {t(s.pricePer, {
                          price: formatPrice(Number(row.plan.priceAmount), locale, row.plan.currency),
                          interval: m.labels.interval[row.plan.interval],
                        })}
                      </span>
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[row.effective] ?? 'neutral'}>
                        {m.labels.subscriptionStatus[row.effective] ?? row.effective}
                      </Badge>
                      {row.trialLeft !== null ? (
                        <>
                          <br />
                          <span className="z-help">
                            {formatCount(s.daysLeft, row.trialLeft, locale)}
                          </span>
                        </>
                      ) : null}
                    </td>
                    <td>
                      <span className="z-help">
                        {row.currentEndAt
                          ? formatDate(row.currentEndAt, locale)
                          : row.trialEndAt
                            ? formatDate(row.trialEndAt, locale)
                            : '—'}
                      </span>
                    </td>
                    <td>
                      <RecordPaymentForm
                        businessId={row.businessId}
                        defaultAmount={Number(row.plan.priceAmount)}
                        currency={row.plan.currency}
                        m={{ admin: m.admin, common: m.common }}
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
        <h2 className="z-profile__h3">{s.recentPayments}</h2>
        {recentPayments.length === 0 ? (
          <p className="z-help">{s.noPayments}</p>
        ) : (
          <div className="z-table--scroll">
            <table className="z-table">
              <thead>
                <tr>
                  <th>{c.date}</th>
                  <th>{c.business}</th>
                  <th>{c.amount}</th>
                  <th>{s.period}</th>
                  <th>{c.status}</th>
                  <th>{s.method}</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.paidAt ?? payment.createdAt, locale)}</td>
                    <td>{payment.subscription.business.name}</td>
                    <td>{formatPrice(Number(payment.amount), locale, payment.currency)}</td>
                    <td>
                      <span className="z-help">
                        {payment.periodStart && payment.periodEnd
                          ? t(s.periodRange, {
                              start: formatDate(payment.periodStart, locale),
                              end: formatDate(payment.periodEnd, locale),
                            })
                          : '—'}
                      </span>
                    </td>
                    <td>
                      <Badge tone={PAYMENT_TONE[payment.status] ?? 'neutral'}>
                        {m.labels.paymentStatus[payment.status]}
                      </Badge>
                    </td>
                    <td>
                      <span className="z-help">
                        {s.providers[payment.provider] ?? payment.provider}
                        {payment.providerRef ? (
                          <>
                            <br />
                            <bdi>{payment.providerRef}</bdi>
                          </>
                        ) : null}
                      </span>
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
        m={{ admin: m.admin, labels: m.labels, common: m.common }}
        locale={locale}
      />
    </div>
  );
}
