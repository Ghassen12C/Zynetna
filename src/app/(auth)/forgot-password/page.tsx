import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/brand/Mark';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.auth.forgotTitle, robots: { index: false, follow: false } };
}

export default async function ForgotPasswordPage() {
  const { m, path } = await translate();

  return (
    <>
      <div className="z-auth__mobile-logo">
        <Link href={path('/')} aria-label={m.nav.homeLabel}>
          <Logo size={36} />
        </Link>
      </div>

      <div>
        <h1 className="z-auth__title">{m.auth.forgotTitle}</h1>
        <p className="z-auth__subtitle">{m.auth.forgotSubtitle}</p>
      </div>

      <ForgotPasswordForm m={m.auth} />

      <p className="z-auth__foot">
        <Link href={path('/login')}>{m.auth.backToLogin}</Link>
      </p>
    </>
  );
}
