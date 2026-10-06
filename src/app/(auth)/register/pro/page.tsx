import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/brand/Mark';
import { RegisterForm } from '../RegisterForm';
import { getActor } from '@/server/auth/session';

export const metadata: Metadata = {
  title: 'Créer mon établissement',
  robots: { index: false, follow: false },
};

/**
 * Professionals register as users first; the business is created in the
 * onboarding step that follows. Same account model, no parallel identity.
 */
export default async function RegisterProPage() {
  if (await getActor()) redirect('/pro/onboarding');

  return (
    <>
      <div className="z-auth__mobile-logo">
        <Link href="/" aria-label="Zynetna — accueil">
          <Logo size={36} />
        </Link>
      </div>

      <div>
        <h1 className="z-auth__title">Mettez votre établissement en ligne</h1>
        <p className="z-auth__subtitle">
          Créez votre compte — vous créerez votre établissement juste après.
          <strong> Deux mois offerts.</strong>
        </p>
      </div>

      <RegisterForm />

      <p className="z-auth__foot">
        Déjà un compte ? <Link href="/login?redirectTo=/pro/onboarding">Se connecter</Link>
      </p>
    </>
  );
}
