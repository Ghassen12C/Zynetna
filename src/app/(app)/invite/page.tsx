import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { getActor } from '@/server/auth/session';
import { peekInvitation } from '@/server/services/invitations';
import { AcceptInvitation } from '@/components/pro/AcceptInvitation';
import { LogoutButton } from '@/components/account/LogoutButton';

export const metadata: Metadata = {
  title: 'Invitation',
  robots: { index: false, follow: false },
};

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="z-container z-narrow">
        <Card>
          <h1 className="z-h2">Lien incomplet</h1>
          <p className="z-body">
            Ce lien d’invitation est incomplet. Demandez à l’établissement de vous en
            renvoyer un.
          </p>
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
          <h1 className="z-h2">Invitation introuvable</h1>
          <p className="z-body">
            Ce lien n’est pas valide. Il a peut-être été recopié en partie, ou
            l’invitation a été supprimée.
          </p>
        </Card>
      </div>
    );
  }

  const actor = await getActor();
  if (!actor) {
    // Sign in first, then come straight back to this invitation.
    redirect(`/login?redirectTo=${encodeURIComponent(`/invite?token=${token}`)}`);
  }

  const blocked =
    invitation.status === 'ACCEPTED'
      ? 'Cette invitation a déjà été utilisée.'
      : invitation.status === 'REVOKED'
        ? 'Cette invitation a été retirée par l’établissement.'
        : invitation.status === 'EXPIRED'
          ? 'Cette invitation a expiré. Demandez-en une nouvelle.'
          : null;

  const wrongAccount =
    invitation.email.toLowerCase() !== actor.email.toLowerCase()
      ? `Cette invitation a été envoyée à ${invitation.email}. Vous êtes connecté en tant que ${actor.email}.`
      : null;

  return (
    <div className="z-container z-narrow">
      <Card>
        <h1 className="z-h2">Rejoindre {invitation.businessName}</h1>
        <p className="z-body">
          {invitation.role === 'BUSINESS_OWNER'
            ? 'Vous êtes invité comme responsable : vous pourrez gérer l’établissement, son équipe et ses prestations.'
            : 'Vous êtes invité comme membre de l’équipe : vous pourrez consulter l’agenda et gérer les rendez-vous.'}
        </p>

        {blocked ? (
          <>
            <Alert tone="warning">{blocked}</Alert>
            <ButtonLink href="/account" variant="secondary">
              Retour à mon compte
            </ButtonLink>
          </>
        ) : wrongAccount ? (
          <>
            <Alert tone="warning">{wrongAccount}</Alert>
            {/* Signing out is a server action, not a route — the invitation
                link survives in the address bar, so signing back in with the
                invited address returns here. */}
            <LogoutButton />
          </>
        ) : (
          <AcceptInvitation token={token} businessName={invitation.businessName} />
        )}
      </Card>
    </div>
  );
}
