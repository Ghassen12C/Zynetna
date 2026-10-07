import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getActor } from '@/server/auth/session';
import { ProfileForm } from '@/components/account/ProfileForm';
import { PasswordForm } from '@/components/account/PasswordForm';
import { LogoutButton } from '@/components/account/LogoutButton';
import { formatCount } from '@/i18n/format';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.account.profile, robots: { index: false } };
}

/** Fill `{email}` in a sentence, keeping the address readable left-to-right. */
function withEmail(template: string, email: string) {
  const [before = '', after = ''] = template.split('{email}');
  return (
    <>
      {before}
      <bdi dir="ltr">{email}</bdi>
      {after}
    </>
  );
}

export default async function ProfilePage() {
  const actor = await getActor();
  if (!actor) redirect('/login?redirectTo=/account/profile');

  const [user, sessions, { m, locale }] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: { firstName: true, lastName: true, email: true, phone: true, locale: true, createdAt: true },
    }),
    db.session.count({ where: { userId: actor.userId, revokedAt: null, expiresAt: { gt: new Date() } } }),
    translate(),
  ]);

  return (
    <div className="z-profile-grid">
      <section className="z-panel">
        <h2 className="z-profile__h3">{m.account.myInformation}</h2>
        <ProfileForm
          user={user}
          m={{ auth: m.auth, account: m.account, common: m.common }}
          emailNote={withEmail(m.account.emailLocked, user.email)}
        />
      </section>

      <section className="z-panel">
        <h2 className="z-profile__h3">{m.account.password}</h2>
        <p className="z-policy">
          {m.account.passwordNotice}
          {sessions > 1 ? ` ${formatCount(m.account.activeSessions, sessions, locale)}` : ''}
        </p>
        <PasswordForm m={{ auth: m.auth, account: m.account }} />
      </section>

      <section className="z-panel">
        <h2 className="z-profile__h3">{m.account.session}</h2>
        <p className="z-policy">{withEmail(m.account.signedInAs, user.email)}</p>
        <LogoutButton label={m.nav.logout} />
      </section>
    </div>
  );
}
