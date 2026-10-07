'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireActor, requireBusinessAccess } from '@/server/auth/guard';
import { recordAudit } from '@/server/audit';
import {
  acceptInvitation,
  inviteToTeam,
  revokeInvitation,
} from '@/server/services/invitations';
import { cuidSchema, emailSchema } from '@/lib/validation/common';
import type { FormState } from '@/lib/formState';
import { parseForm, toFormState } from './formState';

const inviteSchema = z.object({
  businessId: cuidSchema,
  email: emailSchema,
  role: z.enum(['BUSINESS_EMPLOYEE', 'BUSINESS_OWNER']),
  staffMemberId: cuidSchema.optional().or(z.literal('')),
});

export async function inviteTeamMemberAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(inviteSchema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    // Only someone who may change the team can invite into it.
    const { actor, businessId } = await requireBusinessAccess(
      parsed.data.businessId,
      'business.staff.write',
    );

    const invitation = await inviteToTeam({
      businessId,
      email: parsed.data.email,
      role: parsed.data.role,
      staffMemberId: parsed.data.staffMemberId || null,
      invitedBy: actor,
    });

    await recordAudit({
      actor,
      action: 'invitation.created',
      targetType: 'StaffInvitation',
      targetId: invitation.id,
      businessId,
      metadata: { email: parsed.data.email, role: parsed.data.role },
    });

    revalidatePath('/pro/dashboard/team');
    return { status: 'success', message: 'Invitation envoyée.' };
  } catch (error) {
    return toFormState(error, 'inviteTeamMemberAction');
  }
}

const revokeSchema = z.object({
  businessId: cuidSchema,
  invitationId: cuidSchema,
});

export async function revokeInvitationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(revokeSchema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const { actor, businessId } = await requireBusinessAccess(
      parsed.data.businessId,
      'business.staff.write',
    );
    await revokeInvitation(businessId, parsed.data.invitationId);

    await recordAudit({
      actor,
      action: 'invitation.revoked',
      targetType: 'StaffInvitation',
      targetId: parsed.data.invitationId,
      businessId,
    });

    revalidatePath('/pro/dashboard/team');
    return { status: 'success', message: 'Invitation annulée.' };
  } catch (error) {
    return toFormState(error, 'revokeInvitationAction');
  }
}

const acceptSchema = z.object({ token: z.string().min(16).max(256) });

export async function acceptInvitationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(acceptSchema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireActor();
    const result = await acceptInvitation(parsed.data.token, actor);

    await recordAudit({
      actor,
      action: 'invitation.accepted',
      targetType: 'StaffInvitation',
      targetId: parsed.data.token.slice(0, 8),
      metadata: { business: result.businessSlug, role: result.role },
    });

    revalidatePath('/pro/dashboard', 'layout');
  } catch (error) {
    return toFormState(error, 'acceptInvitationAction');
  }

  /**
   * Redirect from the server, not from a `useEffect` on the client.
   *
   * Revalidating re-runs this page, which now reads the invitation as accepted
   * and renders the "already used" branch — unmounting the submitting
   * component before any client-side effect could run. Redirecting here wins
   * that race, and it must sit outside the try: `redirect` signals by throwing,
   * and the catch above would turn it into an error message.
   */
  redirect('/pro/dashboard');
}
