import { redirect } from 'next/navigation';
import { SectionNav } from '@/components/layout/SectionNav';
import { getActor } from '@/server/auth/session';
import { unreadNotificationCount } from '@/server/services/account';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect('/login?redirectTo=/account');

  const unread = await unreadNotificationCount(actor);

  return (
    <div className="z-account">
      <div className="z-container">
        <header className="z-account__head">
          <h1>Bonjour {actor.firstName}</h1>
          <p>Vos rendez-vous, vos favoris et vos avis.</p>
        </header>

        <SectionNav
          items={[
            { href: '/account', label: 'À venir' },
            { href: '/account/history', label: 'Historique' },
            { href: '/account/favorites', label: 'Favoris' },
            { href: '/account/reviews', label: 'Mes avis' },
            { href: '/account/notifications', label: 'Notifications', badge: unread },
            { href: '/account/profile', label: 'Profil' },
          ]}
        />

        <div className="z-account__body">{children}</div>
      </div>
    </div>
  );
}
