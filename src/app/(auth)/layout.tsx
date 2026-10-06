import Link from 'next/link';
import { Logo } from '@/components/brand/Mark';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="z-auth">
      <aside className="z-auth__aside">
        <Link href="/" aria-label="Zynetna — accueil">
          <Logo size={38} tone="var(--z-chaux)" knockout="var(--z-medina)" />
        </Link>

        <div className="z-auth__pitch">
          <h2>Réserve ta chaise. Réserve ton éclat.</h2>
          <p>
            Des centaines de coiffeurs, barbiers, instituts et spas en Tunisie — et un
            rendez-vous confirmé en quelques secondes.
          </p>
          <ul className="z-procta__list">
            <li>Réservation en ligne 24 h/24</li>
            <li>Rappel avant chaque rendez-vous</li>
            <li>Annulation et report en un clic</li>
          </ul>
        </div>

        <p className="z-auth__ar" lang="ar" dir="rtl">
          زينتنا — الحلاقة والتجميل · تونس
        </p>

        <svg className="z-auth__arch" viewBox="0 0 100 138" width="420" aria-hidden="true">
          <path
            d="M0 50a50 50 0 0 1 100 0v80a8 8 0 0 1-8 8H8a8 8 0 0 1-8-8V50Z"
            fill="var(--z-chaux)"
          />
        </svg>
      </aside>

      <main id="main" className="z-auth__main">
        <div className="z-auth__card">{children}</div>
      </main>
    </div>
  );
}
