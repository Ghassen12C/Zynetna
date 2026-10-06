import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/brand/Mark';
import { LoginForm } from './LoginForm';
import { getActor } from '@/server/auth/session';

export const metadata: Metadata = {
  title: 'Se connecter',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  if (await getActor()) redirect('/account');
  const { redirectTo } = await searchParams;

  return (
    <>
      <div className="z-auth__mobile-logo">
        <Link href="/" aria-label="Zynetna — accueil">
          <Logo size={36} />
        </Link>
      </div>

      <div>
        <h1 className="z-auth__title">Content de vous revoir</h1>
        <p className="z-auth__subtitle">Connectez-vous pour gérer vos rendez-vous.</p>
      </div>

      <LoginForm redirectTo={redirectTo} />

      <p className="z-auth__foot">
        Pas encore de compte ? <Link href="/register">Créer un compte</Link>
      </p>
    </>
  );
}
