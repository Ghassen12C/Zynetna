import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/brand/Mark';
import { RegisterForm } from '../RegisterForm';
import { getActor } from '@/server/auth/session';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.dashSetup.registerPro.title, robots: { index: false, follow: false } };
}

/**
 * Professionals register as users first; the business is created in the
 * onboarding step that follows. Same account model, no parallel identity.
 */
export default async function RegisterProPage() {
  const { m, locale, path } = await translate();
  if (await getActor()) redirect(path('/pro/onboarding'));
  const copy = m.dashSetup.registerPro;

  return (
    <>
      <div className="z-auth__mobile-logo">
        <Link href={path('/')} aria-label={copy.homeLabel}>
          <Logo size={36} />
        </Link>
      </div>

      <div>
        <h1 className="z-auth__title">{copy.heading}</h1>
        <p className="z-auth__subtitle">
          {copy.subtitle} <strong>{copy.offer}</strong>
        </p>
      </div>

      <RegisterForm m={m.auth} locale={locale} />

      <p className="z-auth__foot">
        {copy.hasAccount}{' '}
        <Link href={path(`/login?redirectTo=${encodeURIComponent('/pro/onboarding')}`)}>
          {copy.login}
        </Link>
      </p>
    </>
  );
}
