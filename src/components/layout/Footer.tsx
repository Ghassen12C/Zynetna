import Link from 'next/link';
import { Logo } from '@/components/brand/Mark';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="z-footer">
      <div className="z-container z-footer__inner">
        <div className="z-footer__brand">
          <Logo size={34} tone="var(--z-chaux)" knockout="var(--z-medina)" showTagline />
          <p className="z-footer__pitch">
            Coiffeurs, barbiers, instituts de beauté et spas — partout en Tunisie.
          </p>
        </div>

        <nav className="z-footer__col" aria-label="Clients">
          <h2 className="z-eyebrow">Clients</h2>
          <Link href="/search">Rechercher</Link>
          <Link href="/categories">Catégories</Link>
          <Link href="/map">Carte</Link>
          <Link href="/account">Mon compte</Link>
        </nav>

        <nav className="z-footer__col" aria-label="Professionnels">
          <h2 className="z-eyebrow">Professionnels</h2>
          <Link href="/pro">Rejoindre Zynetna</Link>
          <Link href="/pro/onboarding">Créer mon établissement</Link>
          <Link href="/pro/dashboard">Tableau de bord</Link>
        </nav>

        <nav className="z-footer__col" aria-label="Zynetna">
          <h2 className="z-eyebrow">Zynetna</h2>
          <Link href="/about">À propos</Link>
          <Link href="/legal/terms">Conditions</Link>
          <Link href="/legal/privacy">Confidentialité</Link>
        </nav>
      </div>

      <div className="z-container z-footer__base">
        <p>© {year} Zynetna. Tous droits réservés.</p>
        <p lang="ar" dir="rtl">
          زينتنا — الحلاقة والتجميل · تونس
        </p>
      </div>
    </footer>
  );
}
