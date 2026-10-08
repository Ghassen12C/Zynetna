import type { Metadata } from 'next';
import { proContext } from '@/components/pro/ProGuard';
import { TwoFactorSection } from '@/components/account/TwoFactorSection';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.dash.nav.security, robots: { index: false } };
}

/**
 * Security of the professional's own account. Open to every member of the
 * business (owner and employee): it changes nothing about the business, only
 * how this person signs in.
 */
export default async function ProSecurityPage() {
  const { actor } = await proContext('business.read', '/pro/dashboard/security');
  const { m } = await translate();
  return (
    <div className="z-profile-grid">
      <TwoFactorSection userId={actor.userId} note={m.account.twoFactorWhyPro} />
    </div>
  );
}
