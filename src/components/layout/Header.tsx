import Link from 'next/link';
import { Logo } from '@/components/brand/Mark';
import { ButtonLink } from '@/components/ui/Button';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import { MobileMenu, type MenuLink } from '@/components/layout/MobileMenu';
import { getActor } from '@/server/auth/session';
import { isSuperAdmin } from '@/domain/identity/actor';
import { translate } from '@/i18n/server';

/** An account action, plus how the desktop bar dresses it. */
type Action = MenuLink & { look: 'primary' | 'secondary' | 'ghost' | 'link' };

export async function Header() {
  const [actor, { m, locale, path }] = await Promise.all([getActor(), translate()]);
  const hasBusiness = actor ? Object.keys(actor.businessRoles).length > 0 : false;

  // One list of destinations and one of actions feed both the desktop bar and
  // the phone menu, so the two cannot drift into offering different things.
  const links: MenuLink[] = [
    { href: path('/search'), label: m.nav.discover },
    { href: path('/categories'), label: m.nav.categories },
    { href: path('/map'), label: m.nav.map },
    ...(!hasBusiness ? [{ href: path('/pro'), label: m.nav.forPros }] : []),
  ];
  const actions: Action[] = actor
    ? [
        ...(isSuperAdmin(actor)
          ? [{ href: '/admin', label: m.nav.admin, look: 'link' as const }]
          : []),
        ...(hasBusiness
          ? [
              {
                href: '/pro/dashboard',
                label: m.nav.dashboard,
                emphasis: 'primary' as const,
                look: 'secondary' as const,
              },
            ]
          : []),
        { href: path('/account'), label: actor.firstName, look: 'ghost' },
      ]
    : [
        { href: path('/login'), label: m.nav.login, look: 'ghost' },
        {
          href: path('/register'),
          label: m.nav.register,
          emphasis: 'primary',
          look: 'primary',
        },
      ];
  // The menu leads with the main action, where a thumb reaches first.
  const menuActions = [...actions].sort(
    (a, b) => Number(b.emphasis === 'primary') - Number(a.emphasis === 'primary'),
  );

  return (
    <header className="z-header">
      <div className="z-container z-header__inner">
        <Link href={path('/')} aria-label={`${m.brand.name} — ${m.nav.discover}`}>
          <Logo size={34} />
        </Link>

        <nav className="z-header__nav" aria-label={m.nav.discover}>
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="z-header__link">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="z-header__actions">
          <LocaleSwitcher current={locale} />

          {/* On a phone only the language and the menu stay in the bar; the
              account actions move into the menu instead of overflowing. */}
          <div className="z-header__desktop">
            {actions.map((action) =>
              action.look === 'link' ? (
                <Link key={action.href} href={action.href} className="z-header__link">
                  {action.label}
                </Link>
              ) : (
                <ButtonLink key={action.href} href={action.href} variant={action.look} size="sm">
                  {action.label}
                </ButtonLink>
              ),
            )}
          </div>
          <MobileMenu
            links={links}
            actions={menuActions.map(({ href, label, emphasis }) => ({
              href,
              label,
              emphasis,
            }))}
            labels={{ open: m.nav.openMenu, close: m.nav.closeMenu }}
          />
        </div>
      </div>
    </header>
  );
}
