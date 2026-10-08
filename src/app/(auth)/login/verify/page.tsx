import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/brand/Mark';
import { VerifyForm } from './VerifyForm';
import { findLoginChallenge } from '@/server/auth/twoFactor';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.auth.verifyTitle, robots: { index: false, follow: false } };
}

/**
 * Second step of a two-step login. Only reachable with a live pending-login
 * cookie set by the password step; anything else goes back to the login form.
 */
export default async function VerifyLoginPage() {
  const { m, path } = await translate();
  const token = (await cookies()).get('zynetna_2fa')?.value;
  if (!token || !(await findLoginChallenge(token))) redirect(path('/login'));

  return (
    <>
      <div className="z-auth__mobile-logo">
        <Link href={path('/')} aria-label={m.nav.homeLabel}>
          <Logo size={36} />
        </Link>
      </div>

      <div>
        <h1 className="z-auth__title">{m.auth.verifyTitle}</h1>
        <p className="z-auth__subtitle">{m.auth.verifySubtitle}</p>
      </div>

      <VerifyForm m={m.auth} />
    </>
  );
}
