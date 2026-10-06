import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/brand/Mark';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Mot de passe oublié',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="z-auth__mobile-logo">
        <Link href="/" aria-label="Zynetna — accueil">
          <Logo size={36} />
        </Link>
      </div>

      <div>
        <h1 className="z-auth__title">Mot de passe oublié</h1>
        <p className="z-auth__subtitle">
          Indiquez votre adresse e-mail. Nous vous enverrons un lien pour choisir un nouveau
          mot de passe.
        </p>
      </div>

      <ForgotPasswordForm />

      <p className="z-auth__foot">
        <Link href="/login">Retour à la connexion</Link>
      </p>
    </>
  );
}
