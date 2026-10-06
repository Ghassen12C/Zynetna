import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/brand/Mark';
import { SectionNav } from '@/components/layout/SectionNav';
import { getActor } from '@/server/auth/session';
import { isSuperAdmin } from '@/domain/identity/actor';
import { db } from '@/lib/db';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect('/login?redirectTo=/admin');
  // A non-admin is sent home rather than told the area exists.
  if (!isSuperAdmin(actor)) redirect('/');

  const [pending, openReports] = await Promise.all([
    db.business.count({ where: { status: 'PENDING_REVIEW' } }),
    db.contentReport.count({ where: { status: 'OPEN' } }),
  ]);

  return (
    <div className="z-admin">
      <header className="z-admin__bar">
        <div className="z-container z-admin__bar-inner">
          <Link href="/" aria-label="Zynetna — accueil">
            <Logo size={30} tone="var(--z-chaux)" knockout="var(--z-medina)" />
          </Link>
          <span className="z-admin__label">Administration</span>
          <span className="z-admin__who">{actor.email}</span>
        </div>
      </header>

      <div className="z-container">
        <SectionNav
          items={[
            { href: '/admin', label: 'Tableau de bord' },
            { href: '/admin/businesses', label: 'Établissements', badge: pending },
            { href: '/admin/users', label: 'Utilisateurs' },
            { href: '/admin/reservations', label: 'Réservations' },
            { href: '/admin/categories', label: 'Catégories' },
            { href: '/admin/reviews', label: 'Avis' },
            { href: '/admin/reports', label: 'Signalements', badge: openReports },
            { href: '/admin/subscriptions', label: 'Abonnements' },
            { href: '/admin/audit', label: 'Journal' },
            { href: '/admin/settings', label: 'Réglages' },
          ]}
        />

        <main id="main" className="z-admin__body">
          {children}
        </main>
      </div>
    </div>
  );
}
