'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Input, Select } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Primitives';
import { idle, fieldError } from '@/lib/formState';
import {
  inviteTeamMemberAction,
  revokeInvitationAction,
} from '@/server/actions/invitations';

export type InvitationRow = {
  id: string;
  email: string;
  role: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  invitedByName: string;
};

const STATUS_LABEL: Record<InvitationRow['status'], string> = {
  PENDING: 'En attente',
  ACCEPTED: 'Acceptée',
  REVOKED: 'Annulée',
  EXPIRED: 'Expirée',
};

const STATUS_TONE: Record<InvitationRow['status'], 'warning' | 'success' | 'neutral'> = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  REVOKED: 'neutral',
  EXPIRED: 'neutral',
};

function InviteSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Envoyer l’invitation
    </Button>
  );
}

function RevokeButton({ businessId, invitationId }: { businessId: string; invitationId: string }) {
  const [state, action] = useActionState(revokeInvitationAction, idle);
  const { pending } = useFormStatus();
  return (
    <form action={action}>
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="invitationId" value={invitationId} />
      <Button type="submit" variant="ghost" size="sm" loading={pending}>
        Annuler
      </Button>
      {state.status === 'error' ? <span className="z-error">{state.message}</span> : null}
    </form>
  );
}

/**
 * Inviting someone onto the team.
 *
 * The owner never sets an employee's password: they invite an address, and the
 * person joins with their own account. Until that happens the row here says
 * "en attente", so the team list never shows someone who cannot actually sign
 * in.
 */
export function InvitationsPanel({
  businessId,
  invitations,
  unlinkedStaff,
}: {
  businessId: string;
  invitations: InvitationRow[];
  /** Staff rows with no account yet, which an invitation can claim. */
  unlinkedStaff: { id: string; displayName: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(inviteTeamMemberAction, idle);

  const pending = invitations.filter((i) => i.status === 'PENDING');
  const past = invitations.filter((i) => i.status !== 'PENDING');

  return (
    <section className="z-stack" style={{ gap: 'var(--z-space-4)' }}>
      <div className="z-dash__panel-head">
        <div>
          <h2 className="z-profile__h3">Accès à l’établissement ({pending.length})</h2>
          <p className="z-policy">
            Invitez une personne à rejoindre votre équipe avec son propre compte. Elle
            pourra consulter l’agenda et gérer les rendez-vous.
          </p>
        </div>
        {!open ? <Button onClick={() => setOpen(true)}>+ Inviter</Button> : null}
      </div>

      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}
      {state.status === 'success' ? <Alert tone="success">{state.message}</Alert> : null}

      {open ? (
        <form action={action} className="z-panel z-stack" style={{ gap: 'var(--z-space-3)' }}>
          <input type="hidden" name="businessId" value={businessId} />
          <div className="z-grid z-grid--3">
            <Input
              label="Adresse e-mail"
              name="email"
              type="email"
              required
              autoComplete="off"
              placeholder="prenom@exemple.tn"
              error={fieldError(state, 'email')}
            />
            <Select label="Rôle" name="role" defaultValue="BUSINESS_EMPLOYEE">
              <option value="BUSINESS_EMPLOYEE">Membre de l’équipe</option>
              <option value="BUSINESS_OWNER">Responsable</option>
            </Select>
            {unlinkedStaff.length > 0 ? (
              <Select
                label="Lier à une fiche"
                name="staffMemberId"
                hint="Rattache le compte à un professionnel déjà créé."
              >
                <option value="">Aucune</option>
                {unlinkedStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
          <div className="z-row z-row--gap">
            <InviteSubmit />
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Fermer
            </Button>
          </div>
        </form>
      ) : null}

      {invitations.length === 0 ? (
        <p className="z-help">Aucune invitation pour le moment.</p>
      ) : (
        <ul className="z-invites">
          {[...pending, ...past].map((invitation) => (
            <li key={invitation.id} className="z-invite">
              <div>
                <strong>{invitation.email}</strong>
                <span className="z-muted">
                  {' · '}
                  {invitation.role === 'BUSINESS_OWNER' ? 'Responsable' : 'Membre de l’équipe'}
                  {' · '}
                  invité par {invitation.invitedByName}
                </span>
              </div>
              <div className="z-row z-row--gap">
                <Badge tone={STATUS_TONE[invitation.status]}>
                  {STATUS_LABEL[invitation.status]}
                </Badge>
                {invitation.status === 'PENDING' ? (
                  <RevokeButton businessId={businessId} invitationId={invitation.id} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
