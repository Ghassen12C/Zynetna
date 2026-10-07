import Link from 'next/link';
import { Logo } from '@/components/brand/Mark';
import { translate } from '@/i18n/server';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { m, path } = await translate();

  return (
    <div className="z-auth">
      <aside className="z-auth__aside">
        <Link href={path('/')} aria-label={m.nav.homeLabel}>
          <Logo size={38} tone="var(--z-chaux)" knockout="var(--z-medina)" />
        </Link>

        <div className="z-auth__pitch">
          <h2>{m.brand.tagline}</h2>
          <p>{m.auth.pitchBody}</p>
          <ul className="z-procta__list">
            <li>{m.home.benefitBooking}</li>
            <li>{m.auth.pitchReminder}</li>
            <li>{m.auth.pitchCancel}</li>
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
