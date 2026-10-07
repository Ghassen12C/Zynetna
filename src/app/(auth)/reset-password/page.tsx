import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/brand/Mark';
import { Alert } from '@/components/ui/Alert';
import { ResetPasswordForm } from './ResetPasswordForm';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.auth.resetTitle, robots: { index: false, follow: false } };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ token }, { m, locale, path }] = await Promise.all([searchParams, translate()]);

  return (
    <>
      <div className="z-auth__mobile-logo">
        <Link href={path('/')} aria-label={m.nav.homeLabel}>
          <Logo size={36} />
        </Link>
      </div>

      <div>
        <h1 className="z-auth__title">{m.auth.resetTitle}</h1>
        <p className="z-auth__subtitle">{m.auth.resetSubtitle}</p>
      </div>

      {token ? (
        <ResetPasswordForm token={token} m={m.auth} locale={locale} />
      ) : (
        <>
          <Alert tone="error">{m.auth.incompleteLink}</Alert>
          <p className="z-auth__foot">
            <Link href={path('/forgot-password')}>{m.auth.requestNewLink}</Link>
          </p>
        </>
      )}
    </>
  );
}
