import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/brand/Mark';
import { RegisterForm } from './RegisterForm';
import { getActor } from '@/server/auth/session';

export const metadata: Metadata = {
  title: 'Créer un compte',
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  if (await getActor()) redirect('/account');

  return (
    <>
      <div className="z-auth__mobile-logo">
        <Link href="/" aria-label="Zynetna — accueil">
          <Logo size={36} />
        </Link>
      </div>

      <div>
        <h1 className="z-auth__title">Créer un compte</h1>
        <p className="z-auth__subtitle">Réservez en quelques secondes, partout en Tunisie.</p>
      </div>

      <RegisterForm />

      <p className="z-auth__foot">
        Déjà inscrit ? <Link href="/login">Se connecter</Link>
      </p>

      <p className="z-auth__foot">
        Vous êtes professionnel ? <Link href="/register/pro">Créer un établissement</Link>
      </p>
    </>
  );
}
