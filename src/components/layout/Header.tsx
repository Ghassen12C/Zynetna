import Link from 'next/link';
import { Logo } from '@/components/brand/Mark';
import { ButtonLink } from '@/components/ui/Button';
import { getActor } from '@/server/auth/session';
import { isSuperAdmin } from '@/domain/identity/actor';

export async function Header() {
  const actor = await getActor();
  const hasBusiness = actor ? Object.keys(actor.businessRoles).length > 0 : false;

  return (
    <header className="z-header">
      <div className="z-container z-header__inner">
        <Link href="/" aria-label="Zynetna — accueil">
          <Logo size={34} />
        </Link>

        <nav className="z-header__nav" aria-label="Navigation principale">
          <Link href="/search" className="z-header__link">
            Découvrir
          </Link>
          <Link href="/categories" className="z-header__link">
            Catégories
          </Link>
          {!hasBusiness ? (
            <Link href="/pro" className="z-header__link">
              Pour les professionnels
            </Link>
          ) : null}
        </nav>

        <div className="z-header__actions">
          {actor ? (
            <>
              {isSuperAdmin(actor) ? (
                <Link href="/admin" className="z-header__link">
                  Administration
                </Link>
              ) : null}
              {hasBusiness ? (
                <ButtonLink href="/pro/dashboard" variant="secondary" size="sm">
                  Tableau de bord
                </ButtonLink>
              ) : null}
              <ButtonLink href="/account" variant="ghost" size="sm">
                {actor.firstName}
              </ButtonLink>
            </>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm">
                Se connecter
              </ButtonLink>
              <ButtonLink href="/register" variant="primary" size="sm">
                Créer un compte
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
