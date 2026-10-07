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
import { interpolate } from '@/i18n/interpolate';
import type { Messages } from '@/i18n';

type M = { dashSetup: Messages['dashSetup']; common: Messages['common'] };

export type InvitationRow = {
  id: string;
  email: string;
  role: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  invitedByName: string;
};

const STATUS_TONE: Record<InvitationRow['status'], 'warning' | 'success' | 'neutral'> = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  REVOKED: 'neutral',
  EXPIRED: 'neutral',
};

function InviteSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

function RevokeButton({
  label,
  businessId,
  invitationId,
}: {
  label: string;
  businessId: string;
  invitationId: string;
}) {
  const [state, action] = useActionState(revokeInvitationAction, idle);
  const { pending } = useFormStatus();
  return (
    <form action={action}>
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="invitationId" value={invitationId} />
      <Button type="submit" variant="ghost" size="sm" loading={pending}>
        {label}
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
  m,
  businessId,
  invitations,
  unlinkedStaff,
}: {
  m: M;
  businessId: string;
  invitations: InvitationRow[];
  /** Staff rows with no account yet, which an invitation can claim. */
  unlinkedStaff: { id: string; displayName: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(inviteTeamMemberAction, idle);

  const pending = invitations.filter((i) => i.status === 'PENDING');
  const past = invitations.filter((i) => i.status !== 'PENDING');
  const t = m.dashSetup.invitations;
  const roleLabel = (role: string) => (role === 'BUSINESS_OWNER' ? t.roleOwner : t.roleEmployee);

  return (
    <section className="z-stack" style={{ gap: 'var(--z-space-4)' }}>
      <div className="z-dash__panel-head">
        <div>
          <h2 className="z-profile__h3">{interpolate(t.heading, { count: pending.length })}</h2>
          <p className="z-policy">{t.intro}</p>
        </div>
        {!open ? <Button onClick={() => setOpen(true)}>+ {t.invite}</Button> : null}
      </div>

      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}
      {state.status === 'success' ? <Alert tone="success">{state.message}</Alert> : null}

      {open ? (
        <form action={action} className="z-panel z-stack" style={{ gap: 'var(--z-space-3)' }}>
          <input type="hidden" name="businessId" value={businessId} />
          <div className="z-grid z-grid--3">
            <Input
              label={t.email}
              name="email"
              type="email"
              required
              autoComplete="off"
              dir="ltr"
              placeholder={t.emailPlaceholder}
              error={fieldError(state, 'email')}
            />
            <Select label={t.role} name="role" defaultValue="BUSINESS_EMPLOYEE">
              <option value="BUSINESS_EMPLOYEE">{t.roleEmployee}</option>
              <option value="BUSINESS_OWNER">{t.roleOwner}</option>
            </Select>
            {unlinkedStaff.length > 0 ? (
              <Select
                label={t.linkTo}
                name="staffMemberId"
                hint={t.linkToHint}
              >
                <option value="">{m.dashSetup.shared.none}</option>
                {unlinkedStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
          <div className="z-row z-row--gap">
            <InviteSubmit label={t.send} />
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {m.common.close}
            </Button>
          </div>
        </form>
      ) : null}

      {invitations.length === 0 ? (
        <p className="z-help">{t.empty}</p>
      ) : (
        <ul className="z-invites">
          {[...pending, ...past].map((invitation) => (
            <li key={invitation.id} className="z-invite">
              <div>
                <bdi className="z-invite__email">
                  <strong>{invitation.email}</strong>
                </bdi>
                <span className="z-muted">
                  {' · '}
                  {roleLabel(invitation.role)}
                  {' · '}
                  {interpolate(t.invitedBy, { name: invitation.invitedByName })}
                </span>
              </div>
              <div className="z-row z-row--gap">
                <Badge tone={STATUS_TONE[invitation.status]}>
                  {t.status[invitation.status]}
                </Badge>
                {invitation.status === 'PENDING' ? (
                  <RevokeButton
                    label={t.revoke}
                    businessId={businessId}
                    invitationId={invitation.id}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
