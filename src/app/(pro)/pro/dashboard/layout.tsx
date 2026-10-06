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
          items={[
            { href: '/pro/dashboard', label: 'Vue d’ensemble' },
            { href: '/pro/dashboard/calendar', label: 'Agenda' },
            { href: '/pro/dashboard/reservations', label: 'Réservations' },
            { href: '/pro/dashboard/services', label: 'Prestations' },
            { href: '/pro/dashboard/team', label: 'Équipe' },
            { href: '/pro/dashboard/hours', label: 'Horaires' },
            { href: '/pro/dashboard/gallery', label: 'Photos' },
            { href: '/pro/dashboard/customers', label: 'Clients' },
            { href: '/pro/dashboard/reviews', label: 'Avis' },
            { href: '/pro/dashboard/analytics', label: 'Statistiques' },
            { href: '/pro/dashboard/profile', label: 'Mon établissement' },
            { href: '/pro/dashboard/subscription', label: 'Abonnement' },
          ]}
        />

        <div className="z-pro__body">{children}</div>
      </div>
    </div>
  );
}
