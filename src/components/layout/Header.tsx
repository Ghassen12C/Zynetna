import Link from "next/link";
import { Logo } from "@/components/brand/Mark";
import { ButtonLink } from "@/components/ui/Button";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { MobileMenu, type MenuLink } from "@/components/layout/MobileMenu";
import { getActor } from "@/server/auth/session";
import { isSuperAdmin } from "@/domain/identity/actor";
import { translate } from "@/i18n/server";

export async function Header() {
  const [actor, { m, locale, path }] = await Promise.all([
    getActor(),
    translate(),
  ]);
  const hasBusiness = actor
    ? Object.keys(actor.businessRoles).length > 0
    : false;

  // One list feeds both the desktop bar and the phone menu, so they cannot
  // drift into offering different destinations.
  const links: MenuLink[] = [
    { href: path("/search"), label: m.nav.discover },
    { href: path("/categories"), label: m.nav.categories },
    { href: path("/map"), label: m.nav.map },
    ...(!hasBusiness ? [{ href: path("/pro"), label: m.nav.forPros }] : []),
  ];
  const mobileActions: MenuLink[] = actor
    ? [
        ...(hasBusiness
          ? [
              {
                href: "/pro/dashboard",
                label: m.nav.dashboard,
                emphasis: "primary" as const,
              },
            ]
          : []),
        ...(isSuperAdmin(actor)
          ? [{ href: "/admin", label: m.nav.admin }]
          : []),
        { href: path("/account"), label: m.nav.account },
      ]
    : [
        { href: path("/register"), label: m.nav.register, emphasis: "primary" },
        { href: path("/login"), label: m.nav.login },
      ];

  return (
    <header className="z-header">
      <div className="z-container z-header__inner">
        <Link
          href={path("/")}
          aria-label={`${m.brand.name} — ${m.nav.discover}`}
        >
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
            {actor ? (
              <>
                {isSuperAdmin(actor) ? (
                  <Link href="/admin" className="z-header__link">
                    {m.nav.admin}
                  </Link>
                ) : null}
                {hasBusiness ? (
                  <ButtonLink
                    href="/pro/dashboard"
                    variant="secondary"
                    size="sm"
                  >
                    {m.nav.dashboard}
                  </ButtonLink>
                ) : null}
                <ButtonLink href={path("/account")} variant="ghost" size="sm">
                  {actor.firstName}
                </ButtonLink>
              </>
            ) : (
              <>
                <ButtonLink href={path("/login")} variant="ghost" size="sm">
                  {m.nav.login}
                </ButtonLink>
                <ButtonLink
                  href={path("/register")}
                  variant="primary"
                  size="sm"
                >
                  {m.nav.register}
                </ButtonLink>
              </>
            )}
          </div>
          <MobileMenu
            links={links}
            actions={mobileActions}
            labels={{ open: m.nav.openMenu, close: m.nav.closeMenu }}
          />
        </div>
      </div>
    </header>
  );
}
