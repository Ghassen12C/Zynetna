import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/brand/Mark';
import { Alert } from '@/components/ui/Alert';
import { ResetPasswordForm } from './ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Nouveau mot de passe',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <>
      <div className="z-auth__mobile-logo">
        <Link href="/" aria-label="Zynetna — accueil">
          <Logo size={36} />
        </Link>
      </div>

      <div>
        <h1 className="z-auth__title">Nouveau mot de passe</h1>
        <p className="z-auth__subtitle">
          Choisissez un mot de passe. Vos autres appareils seront déconnectés.
        </p>
      </div>

      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <>
          <Alert tone="error">
            Lien incomplet. Ouvrez le lien reçu par e-mail, ou demandez-en un nouveau.
          </Alert>
          <p className="z-auth__foot">
            <Link href="/forgot-password">Demander un nouveau lien</Link>
          </p>
        </>
      )}
    </>
  );
}
