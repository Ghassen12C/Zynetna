import Link from 'next/link';
import { Logo } from '@/components/brand/Mark';
import { translate } from '@/i18n/server';

export async function Footer() {
  const { m, path } = await translate();
  const year = new Date().getFullYear();

  return (
    <footer className="z-footer">
      <div className="z-container z-footer__inner">
        <div className="z-footer__brand">
          <Logo size={34} tone="var(--z-chaux)" knockout="var(--z-medina)" showTagline />
          <p className="z-footer__pitch">{m.home.heroSubtitle}</p>
        </div>

        <nav className="z-footer__col" aria-label={m.footer.customers}>
          <h2 className="z-eyebrow">{m.footer.customers}</h2>
          <Link href={path('/search')}>{m.home.search}</Link>
          <Link href={path('/categories')}>{m.nav.categories}</Link>
          <Link href={path('/map')}>{m.nav.map}</Link>
          <Link href={path('/account')}>{m.nav.account}</Link>
        </nav>

        <nav className="z-footer__col" aria-label={m.footer.professionals}>
          <h2 className="z-eyebrow">{m.footer.professionals}</h2>
          <Link href={path('/pro')}>{m.footer.joinZynetna}</Link>
          <Link href={path('/pro/onboarding')}>{m.footer.createBusiness}</Link>
          <Link href={path('/pro/dashboard')}>{m.nav.dashboard}</Link>
        </nav>

        <nav className="z-footer__col" aria-label={m.footer.company}>
          <h2 className="z-eyebrow">{m.footer.company}</h2>
          <Link href={path('/about')}>{m.footer.about}</Link>
          <Link href={path('/legal/terms')}>{m.footer.terms}</Link>
          <Link href={path('/legal/privacy')}>{m.footer.privacy}</Link>
        </nav>
      </div>

      <div className="z-container z-footer__base">
        <p>
          © {year} {m.brand.name}. {m.footer.rights}
        </p>
        <p lang="ar" dir="rtl">
          زينتنا — الحلاقة والتجميل · تونس
        </p>
      </div>
    </footer>
  );
}
