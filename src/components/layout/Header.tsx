import Link from 'next/link';
import { Logo } from '@/components/brand/Mark';
import { ButtonLink } from '@/components/ui/Button';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import { getActor } from '@/server/auth/session';
import { isSuperAdmin } from '@/domain/identity/actor';
import { translate } from '@/i18n/server';

export async function Header() {
  const [actor, { m, locale, path }] = await Promise.all([getActor(), translate()]);
  const hasBusiness = actor ? Object.keys(actor.businessRoles).length > 0 : false;

  return (
    <header className="z-header">
      <div className="z-container z-header__inner">
        <Link href={path('/')} aria-label={`${m.brand.name} — ${m.nav.discover}`}>
          <Logo size={34} />
        </Link>

        <nav className="z-header__nav" aria-label={m.nav.discover}>
          <Link href={path('/search')} className="z-header__link">
            {m.nav.discover}
          </Link>
          <Link href={path('/categories')} className="z-header__link">
            {m.nav.categories}
          </Link>
          {!hasBusiness ? (
            <Link href={path('/pro')} className="z-header__link">
              {m.nav.forPros}
            </Link>
          ) : null}
        </nav>

        <div className="z-header__actions">
          <LocaleSwitcher current={locale} />

          {actor ? (
            <>
              {isSuperAdmin(actor) ? (
                <Link href="/admin" className="z-header__link">
                  {m.nav.admin}
                </Link>
              ) : null}
              {hasBusiness ? (
                <ButtonLink href="/pro/dashboard" variant="secondary" size="sm">
                  {m.nav.dashboard}
                </ButtonLink>
              ) : null}
              <ButtonLink href={path('/account')} variant="ghost" size="sm">
                {actor.firstName}
              </ButtonLink>
            </>
          ) : (
            <>
              <ButtonLink href={path('/login')} variant="ghost" size="sm">
                {m.nav.login}
              </ButtonLink>
              <ButtonLink href={path('/register')} variant="primary" size="sm">
                {m.nav.register}
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
