import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getActor } from '@/server/auth/session';
import { ProfileForm } from '@/components/account/ProfileForm';
import { PasswordForm } from '@/components/account/PasswordForm';
import { LogoutButton } from '@/components/account/LogoutButton';

export const metadata: Metadata = { title: 'Profil', robots: { index: false } };

export default async function ProfilePage() {
  const actor = await getActor();
  if (!actor) redirect('/login?redirectTo=/account/profile');

  const [user, sessions] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: { firstName: true, lastName: true, email: true, phone: true, locale: true, createdAt: true },
    }),
    db.session.count({ where: { userId: actor.userId, revokedAt: null, expiresAt: { gt: new Date() } } }),
  ]);

  return (
    <div className="z-profile-grid">
      <section className="z-panel">
        <h2 className="z-profile__h3">Mes informations</h2>
        <ProfileForm user={user} />
      </section>

      <section className="z-panel">
        <h2 className="z-profile__h3">Mot de passe</h2>
        <p className="z-policy">
          Changer votre mot de passe déconnecte vos autres appareils.
          {sessions > 1 ? ` ${sessions} sessions actives.` : ''}
        </p>
        <PasswordForm />
      </section>

      <section className="z-panel">
        <h2 className="z-profile__h3">Session</h2>
        <p className="z-policy">Connecté avec {user.email}.</p>
        <LogoutButton />
      </section>
    </div>
  );
}
