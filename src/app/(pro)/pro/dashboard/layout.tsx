import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import { SectionNav } from '@/components/layout/SectionNav';
import { getActor } from '@/server/auth/session';
import { primaryBusinessId } from '@/server/auth/guard';
import { businessHeader } from '@/server/services/proDashboard';
import { getSubscriptionView } from '@/server/services/subscriptions';
import { formatPrice } from '@/i18n/format';
import { can } from '@/domain/identity/actor';
import { PRO_NAV } from '@/domain/identity/proNav';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon',
  PENDING_REVIEW: 'En attente de validation',
  ACTIVE: 'En ligne',
  SUSPENDED: 'Suspendu',
  REJECTED: 'Refusé',
};

export default async function ProDashboardLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect('/login?redirectTo=/pro/dashboard');

  const businessId = await primaryBusinessId(actor);
  // A signed-in user with no business belongs in onboarding, not here.
  if (!businessId) redirect('/pro/onboarding');

  const [business, subscription] = await Promise.all([
    businessHeader(businessId),
    getSubscriptionView(businessId),
  ]);

  const trialLeft = subscription?.trialDaysLeft ?? null;

  /**
   * The navigation shows only what this person may actually open.
   *
   * An employee holds a narrow set of permissions, and offering them a link
   * that answers with "access denied" is worse than not offering it: the page
   * guards already refuse, so the menu should agree with them.
   */
  const navItems = PRO_NAV.filter((item) => can(actor, item.permission, { businessId })).map(
    ({ href, label }) => ({ href, label }),
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
                  {STATUS_LABEL[business.status] ?? business.status}
                </Badge>
                {business.verification === 'VERIFIED' ? (
                  <Badge tone="accent">✓ Vérifié</Badge>
                ) : null}
                {subscription && !subscription.entitled ? (
                  <Badge tone="danger">Abonnement expiré</Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="z-pro__head-actions">
            <ButtonLink href="/pro/preview" variant="secondary" size="sm">
              Voir ma page
            </ButtonLink>
            {business.status === 'ACTIVE' ? (
              <ButtonLink href={`/business/${business.slug}`} variant="ghost" size="sm">
                Page publique ↗
              </ButtonLink>
            ) : null}
          </div>
        </header>

        {trialLeft !== null && trialLeft <= 14 ? (
          <div className="z-trialbar">
            <span>
              <strong>Essai gratuit — {trialLeft} jour{trialLeft > 1 ? 's' : ''} restant{trialLeft > 1 ? 's' : ''}.</strong>{' '}
              Ensuite {formatPrice(Number(subscription!.plan.priceAmount), 'fr', subscription!.plan.currency)} par mois.
            </span>
            <Link href="/pro/dashboard/subscription">Gérer mon abonnement →</Link>
          </div>
        ) : null}

        {subscription && !subscription.entitled ? (
          <div className="z-trialbar z-trialbar--danger">
            <span>
              <strong>Votre abonnement a expiré.</strong> Votre établissement n’apparaît plus dans
              les recherches et ne reçoit plus de nouvelles réservations. Les rendez-vous déjà
              pris sont maintenus.
            </span>
            <Link href="/pro/dashboard/subscription">Réactiver →</Link>
          </div>
        ) : null}

        <SectionNav
          items={navItems}
        />

        <div className="z-pro__body">{children}</div>
      </div>
    </div>
  );
}
