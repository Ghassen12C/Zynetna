import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/brand/Mark';
import { LoginForm } from './LoginForm';
import { getActor } from '@/server/auth/session';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.auth.submitLogin, robots: { index: false, follow: false } };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { m, locale, path } = await translate();
  if (await getActor()) redirect(path('/account'));
  const { redirectTo } = await searchParams;

  return (
    <>
      <div className="z-auth__mobile-logo">
        <Link href={path('/')} aria-label={m.nav.homeLabel}>
          <Logo size={36} />
        </Link>
      </div>

      <div>
        <h1 className="z-auth__title">{m.auth.loginTitle}</h1>
        <p className="z-auth__subtitle">{m.auth.loginSubtitle}</p>
      </div>

      <LoginForm redirectTo={redirectTo} m={m.auth} locale={locale} />

      <p className="z-auth__foot">
        {m.auth.noAccount} <Link href={path('/register')}>{m.nav.register}</Link>
      </p>
    </>
  );
}
