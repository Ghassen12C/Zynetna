import { TwoFactorPanel } from './TwoFactorPanel';
import { twoFactorStatus } from '@/server/auth/twoFactor';
import { translate } from '@/i18n/server';

/**
 * The two-step login panel for the signed-in person's own account. Shared by
 * the customer profile, the professional dashboard and the admin area, so it
 * behaves the same wherever someone looks for it. It only ever acts on the
 * caller's own account: the actions take the user from the session, never
 * from this component.
 */
export async function TwoFactorSection({ userId, note }: { userId: string; note?: string }) {
  const [status, { m, locale }] = await Promise.all([twoFactorStatus(userId), translate()]);
  return (
    <section className="z-panel">
      <h2 className="z-profile__h3">{m.account.twoFactorTitle}</h2>
      {note ? <p className="z-policy">{note}</p> : null}
      <TwoFactorPanel
        enabledAt={status.enabledAt?.toISOString() ?? null}
        recoveryLeft={status.recoveryLeft}
        m={{ auth: m.auth, account: m.account, common: m.common }}
        locale={locale}
      />
    </section>
  );
}
