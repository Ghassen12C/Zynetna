import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { getActor } from '@/server/auth/session';
import { peekInvitation } from '@/server/services/invitations';
import { AcceptInvitation } from '@/components/pro/AcceptInvitation';
import { LogoutButton } from '@/components/account/LogoutButton';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.dashSetup.invite.title, robots: { index: false, follow: false } };
}

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const { m, t, path } = await translate();
  const copy = m.dashSetup.invite;

  if (!token) {
    return (
      <div className="z-container z-narrow">
        <Card>
          <h1 className="z-h2">{copy.incompleteTitle}</h1>
          <p className="z-body">{copy.incompleteBody}</p>
        </Card>
      </div>
    );
  }

  const invitation = await peekInvitation(token);

  // A wrong or made-up token and a withdrawn one are told apart, because the
  // person needs to know whether to ask again or to check their link.
  if (!invitation) {
    return (
      <div className="z-container z-narrow">
        <Card>
          <h1 className="z-h2">{copy.notFoundTitle}</h1>
          <p className="z-body">{copy.notFoundBody}</p>
        </Card>
      </div>
    );
  }

  const actor = await getActor();
  if (!actor) {
    // Sign in first, then come straight back to this invitation.
    redirect(path(`/login?redirectTo=${encodeURIComponent(`/invite?token=${token}`)}`));
  }

  const blocked =
    invitation.status === 'ACCEPTED'
      ? copy.accepted
      : invitation.status === 'REVOKED'
        ? copy.revoked
        : invitation.status === 'EXPIRED'
          ? copy.expired
          : null;

  const wrongAccount =
    invitation.email.toLowerCase() !== actor.email.toLowerCase()
      ? t(copy.wrongAccount, { invited: invitation.email, current: actor.email })
      : null;
  const joinLabel = t(copy.join, { business: invitation.businessName });

  return (
    <div className="z-container z-narrow">
      <Card>
        <h1 className="z-h2">{joinLabel}</h1>
        <p className="z-body">
          {invitation.role === 'BUSINESS_OWNER' ? copy.asOwner : copy.asEmployee}
        </p>

        {blocked ? (
          <>
            <Alert tone="warning">{blocked}</Alert>
            <ButtonLink href={path('/account')} variant="secondary">
              {copy.backToAccount}
            </ButtonLink>
          </>
        ) : wrongAccount ? (
          <>
            <Alert tone="warning">{wrongAccount}</Alert>
            {/* Signing out is a server action, not a route — the invitation
                link survives in the address bar, so signing back in with the
                invited address returns here. */}
            <LogoutButton label={m.nav.logout} />
          </>
        ) : (
          <AcceptInvitation token={token} submitLabel={joinLabel} />
        )}
      </Card>
    </div>
  );
}
