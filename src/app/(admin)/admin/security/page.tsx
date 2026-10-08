import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/server/auth/guard';
import { TwoFactorSection } from '@/components/account/TwoFactorSection';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.admin.nav.security, robots: { index: false } };
}

/** The admin's own two-step login. Resetting someone else's is under Users. */
export default async function AdminSecurityPage() {
  const actor = await requireSuperAdmin();
  const { m } = await translate();
  return (
    <div className="z-profile-grid">
      <TwoFactorSection userId={actor.userId} note={m.account.twoFactorWhyAdmin} />
    </div>
  );
}
