import { redirect } from 'next/navigation';
import { SectionNav } from '@/components/layout/SectionNav';
import { getActor } from '@/server/auth/session';
import { unreadNotificationCount } from '@/server/services/account';
import { translate } from '@/i18n/server';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect('/login?redirectTo=/account');

  const [unread, { m, t, path }] = await Promise.all([
    unreadNotificationCount(actor),
    translate(),
  ]);

  return (
    <div className="z-account">
      <div className="z-container">
        <header className="z-account__head">
          <h1>{t(m.account.greeting, { name: actor.firstName })}</h1>
          <p>{m.account.subtitle}</p>
        </header>

        <SectionNav
          label={m.nav.account}
          items={[
            { href: path('/account'), label: m.account.upcoming },
            { href: path('/account/history'), label: m.account.history },
            { href: path('/account/favorites'), label: m.account.favorites },
            { href: path('/account/reviews'), label: m.account.reviews },
            {
              href: path('/account/notifications'),
              label: m.account.notifications,
              badge: unread,
            },
            { href: path('/account/profile'), label: m.account.profile },
          ]}
        />

        <div className="z-account__body">{children}</div>
      </div>
    </div>
  );
}
