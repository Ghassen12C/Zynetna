import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/brand/Mark';
import { SectionNav } from '@/components/layout/SectionNav';
import { getActor } from '@/server/auth/session';
import { isSuperAdmin } from '@/domain/identity/actor';
import { db } from '@/lib/db';
import { translate } from '@/i18n/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { m, path } = await translate();
  const actor = await getActor();
  if (!actor) redirect(`${path('/login')}?redirectTo=${path('/admin')}`);
  // A non-admin is sent home rather than told the area exists.
  if (!isSuperAdmin(actor)) redirect(path('/'));

  const [pending, openReports] = await Promise.all([
    db.business.count({ where: { status: 'PENDING_REVIEW' } }),
    db.contentReport.count({ where: { status: 'OPEN' } }),
  ]);

  const nav = m.admin.nav;

  return (
    <div className="z-admin">
      <header className="z-admin__bar">
        <div className="z-container z-admin__bar-inner">
          <Link href={path('/')} aria-label={m.admin.shell.home}>
            <Logo size={30} tone="var(--z-chaux)" knockout="var(--z-medina)" />
          </Link>
          <span className="z-admin__label">{m.admin.shell.title}</span>
          <span className="z-admin__who" dir="ltr">
            {actor.email}
          </span>
        </div>
      </header>

      <div className="z-container">
        <SectionNav
          label={m.admin.shell.sections}
          items={[
            { href: path('/admin'), label: nav.overview },
            { href: path('/admin/businesses'), label: nav.businesses, badge: pending },
            { href: path('/admin/users'), label: nav.users },
            { href: path('/admin/reservations'), label: nav.reservations },
            { href: path('/admin/categories'), label: nav.categories },
            { href: path('/admin/reviews'), label: nav.reviews },
            { href: path('/admin/reports'), label: nav.reports, badge: openReports },
            { href: path('/admin/subscriptions'), label: nav.subscriptions },
            { href: path('/admin/audit'), label: nav.audit },
            { href: path('/admin/settings'), label: nav.settings },
            { href: path('/admin/security'), label: nav.security },
          ]}
        />

        <main id="main" className="z-admin__body">
          {children}
        </main>
      </div>
    </div>
  );
}
