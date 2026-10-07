import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import { SectionNav } from '@/components/layout/SectionNav';
import { getActor } from '@/server/auth/session';
import { primaryBusinessId } from '@/server/auth/guard';
import { businessHeader } from '@/server/services/proDashboard';
import { getSubscriptionView } from '@/server/services/subscriptions';
import { Arrow } from '@/components/ui/Arrow';
import { formatCount, formatPrice } from '@/i18n/format';
import { translate } from '@/i18n/server';
import { can } from '@/domain/identity/actor';
import { PRO_NAV } from '@/domain/identity/proNav';

export default async function ProDashboardLayout({ children }: { children: React.ReactNode }) {
  const { m, locale, t, path } = await translate();
  const actor = await getActor();
  if (!actor) redirect(path('/login?redirectTo=/pro/dashboard'));

  const businessId = await primaryBusinessId(actor);
  // A signed-in user with no business belongs in onboarding, not here.
  if (!businessId) redirect(path('/pro/onboarding'));

  const [business, subscription] = await Promise.all([
    businessHeader(businessId),
    getSubscriptionView(businessId),
  ]);
  const d = m.dash.layout;

  const trialLeft = subscription?.trialDaysLeft ?? null;

  /**
   * The navigation shows only what this person may actually open.
   *
   * An employee holds a narrow set of permissions, and offering them a link
   * that answers with "access denied" is worse than not offering it: the page
   * guards already refuse, so the menu should agree with them.
   */
  const navItems = PRO_NAV.filter((item) => can(actor, item.permission, { businessId })).map(
    ({ href, labelKey }) => ({ href: path(href), label: m.dash.nav[labelKey] }),
  );

  return (
    <div className="z-pro">
      <div className="z-container">
        <header className="z-pro__head">
          <div className="z-pro__identity">
            <div className="z-pro__logo">
              {business.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={business.logoUrl} alt="" />
              ) : (
                <svg viewBox="0 0 100 138" width="26" aria-hidden="true">
                  <path
                    d="M0 50a50 50 0 0 1 100 0v80a8 8 0 0 1-8 8H8a8 8 0 0 1-8-8V50Z"
                    fill="var(--z-medina)"
                  />
                </svg>
              )}
            </div>
            <div>
              <h1>{business.name}</h1>
              <div className="z-pro__badges">
                <Badge tone={business.status === 'ACTIVE' ? 'success' : 'warning'}>
                  {m.labels.businessStatus[business.status] ?? business.status}
                </Badge>
                {business.verification === 'VERIFIED' ? (
                  <Badge tone="accent">
                    <span aria-hidden="true">✓</span> {m.labels.verification.VERIFIED}
                  </Badge>
                ) : null}
                {subscription && !subscription.entitled ? (
                  <Badge tone="danger">{d.subscriptionExpired}</Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="z-pro__head-actions">
            <ButtonLink href={path('/pro/preview')} variant="secondary" size="sm">
              {d.viewMyPage}
            </ButtonLink>
            {business.status === 'ACTIVE' ? (
              <ButtonLink href={path(`/business/${business.slug}`)} variant="ghost" size="sm">
                {d.publicPage} <Arrow to="external" />
              </ButtonLink>
            ) : null}
          </div>
        </header>

        {trialLeft !== null && trialLeft <= 14 ? (
          <div className="z-trialbar">
            <span>
              <strong>{formatCount(d.trialLeft, trialLeft, locale)}</strong>{' '}
              {t(d.trialThen, {
                price: formatPrice(
                  Number(subscription!.plan.priceAmount),
                  locale,
                  subscription!.plan.currency,
                ),
                interval: m.labels.interval[subscription!.plan.interval],
              })}
            </span>
            <Link href={path('/pro/dashboard/subscription')}>
              {d.manageSubscription} <Arrow />
            </Link>
          </div>
        ) : null}

        {subscription && !subscription.entitled ? (
          <div className="z-trialbar z-trialbar--danger">
            <span>
              <strong>{d.expiredTitle}</strong> {d.expiredBody}
            </span>
            <Link href={path('/pro/dashboard/subscription')}>
              {d.reactivate} <Arrow />
            </Link>
          </div>
        ) : null}

        <SectionNav items={navItems} label={d.navLabel} />

        <div className="z-pro__body">{children}</div>
      </div>
    </div>
  );
}
