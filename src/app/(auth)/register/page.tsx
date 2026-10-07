import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/brand/Mark';
import { RegisterForm } from './RegisterForm';
import { getActor } from '@/server/auth/session';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.auth.registerTitle, robots: { index: false, follow: false } };
}

export default async function RegisterPage() {
  const { m, locale, path } = await translate();
  if (await getActor()) redirect(path('/account'));

  return (
    <>
      <div className="z-auth__mobile-logo">
        <Link href={path('/')} aria-label={m.nav.homeLabel}>
          <Logo size={36} />
        </Link>
      </div>

      <div>
        <h1 className="z-auth__title">{m.auth.registerTitle}</h1>
        <p className="z-auth__subtitle">{m.auth.registerSubtitle}</p>
      </div>

      <RegisterForm m={m.auth} locale={locale} />

      <p className="z-auth__foot">
        {m.auth.hasAccount} <Link href={path('/login')}>{m.nav.login}</Link>
      </p>

      <p className="z-auth__foot">
        {m.home.proCtaTitle} <Link href={path('/register/pro')}>{m.footer.createBusiness}</Link>
      </p>
    </>
  );
}
