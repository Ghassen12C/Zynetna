import 'server-only';
import type { RoleName } from '@prisma/client';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { conflict, forbidden, invalid, notFound } from '@/lib/errors';
import { generateToken, hashToken } from '@/server/auth/hash';
import { emailProvider } from '@/server/providers/notifications';
import type { Actor } from '@/domain/identity/actor';
import { DEFAULT_LOCALE, LOCALE_META, type Locale, isLocale, localePath } from '@/i18n/config';
import { interpolate } from '@/i18n/interpolate';
import { messagesFor } from '@/i18n';

/**
 * Team invitations.
 *
 * An owner cannot create an employee's account for them — that would mean
 * choosing someone else's password and leaving a credential the owner knows.
 * Instead the owner invites an address, the person signs in or registers
 * themselves, and the role assignment comes into being only when they accept.
 *
 * The token follows the same rules as a session: generated server-side, stored
 * only as a SHA-256 hash, single use, and short-lived. A leaked database row
 * is therefore not redeemable.
 */

const INVITE_TTL_DAYS = 7;

/** Roles an owner may hand out. Never SUPER_ADMIN, never through this path. */
const INVITABLE: readonly RoleName[] = ['BUSINESS_EMPLOYEE', 'BUSINESS_OWNER'];

export type InvitationView = {
  id: string;
  email: string;
  role: RoleName;
  createdAt: Date;
  expiresAt: Date;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  staffMemberId: string | null;
  invitedByName: string;
};

function statusOf(row: {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}): InvitationView['status'] {
  if (row.acceptedAt) return 'ACCEPTED';
  if (row.revokedAt) return 'REVOKED';
  if (row.expiresAt.getTime() < Date.now()) return 'EXPIRED';
  return 'PENDING';
}

export async function listInvitations(businessId: string): Promise<InvitationView[]> {
  const rows = await db.staffInvitation.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      staffMemberId: true,
      invitedBy: { select: { firstName: true, lastName: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    status: statusOf(r),
    staffMemberId: r.staffMemberId,
    invitedByName: `${r.invitedBy.firstName} ${r.invitedBy.lastName}`,
  }));
}

export async function inviteToTeam(input: {
  businessId: string;
  email: string;
  role: RoleName;
  /** Optional staff row to link the account to on acceptance. */
  staffMemberId?: string | null;
  invitedBy: Actor;
  /** The inviter's language, used for the email when the invitee has no account. */
  locale?: Locale;
}) {
  if (!INVITABLE.includes(input.role)) {
    throw invalid('roleNotInvitable');
  }

  const business = await db.business.findUnique({
    where: { id: input.businessId },
    select: { id: true, name: true },
  });
  if (!business) throw notFound('businessNotFound');

  // A staff row, when given, must belong to this business — otherwise an owner
  // could attach an employee of theirs to somebody else's roster.
  if (input.staffMemberId) {
    const staff = await db.staffMember.findFirst({
      where: { id: input.staffMemberId, businessId: business.id },
      select: { id: true, userId: true },
    });
    if (!staff) throw notFound('staffNotFound');
    if (staff.userId) throw conflict('staffAlreadyLinked');
  }

  // Already on the team? Re-inviting would be noise, and accepting would be a
  // no-op, so say so plainly instead.
  const existing = await db.user.findUnique({
    where: { email: input.email },
    select: { id: true, locale: true },
  });
  if (existing) {
    const already = await db.roleAssignment.findFirst({
      where: { userId: existing.id, businessId: business.id },
      select: { id: true },
    });
    if (already) throw conflict('alreadyOnTeam');
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);

  let invitation;
  try {
    invitation = await db.staffInvitation.create({
      data: {
        businessId: business.id,
        staffMemberId: input.staffMemberId ?? null,
        email: input.email,
        role: input.role,
        tokenHash: hashToken(token),
        invitedById: input.invitedBy.userId,
        expiresAt,
      },
      select: { id: true },
    });
  } catch (error) {
    // The partial unique index means one outstanding invitation per address.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw conflict('invitationPending');
    }
    throw error;
  }

  await sendInvitationEmail({
    email: input.email,
    businessName: business.name,
    inviterName: `${input.invitedBy.firstName} ${input.invitedBy.lastName}`,
    token,
    expiresAt,
    // The invitee's own language when they already have an account.
    locale:
      existing?.locale && isLocale(existing.locale)
        ? existing.locale
        : (input.locale ?? DEFAULT_LOCALE),
  });

  return { id: invitation.id, token, expiresAt };
}

export async function revokeInvitation(businessId: string, invitationId: string) {
  // Scoped to the business, so an id from another tenant simply is not found.
  const invitation = await db.staffInvitation.findFirst({
    where: { id: invitationId, businessId },
    select: { id: true, acceptedAt: true, revokedAt: true },
  });
  if (!invitation) throw notFound();
  if (invitation.acceptedAt) throw conflict('invitationAlreadyAccepted');
  if (invitation.revokedAt) return { revoked: true };

  await db.staffInvitation.update({
    where: { id: invitation.id },
    data: { revokedAt: new Date() },
  });
  return { revoked: true };
}

/** What the acceptance page shows before the visitor commits to anything. */
export async function peekInvitation(token: string) {
  const invitation = await db.staffInvitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      business: { select: { name: true, slug: true } },
    },
  });
  if (!invitation) return null;

  return {
    email: invitation.email,
    role: invitation.role,
    businessName: invitation.business.name,
    status: statusOf(invitation),
  };
}

/**
 * Accept an invitation.
 *
 * Everything happens in one transaction: the role is granted, the staff row is
 * linked, and the invitation is marked used. A second attempt with the same
 * token finds it already accepted and is refused, so a forwarded email cannot
 * put two people on the roster.
 */
export async function acceptInvitation(token: string, actor: Actor) {
  const tokenHash = hashToken(token);

  return db.$transaction(async (tx) => {
    const invitation = await tx.staffInvitation.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        businessId: true,
        staffMemberId: true,
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        business: { select: { name: true, slug: true } },
      },
    });

    if (!invitation) throw notFound('invitationInvalid');
    if (invitation.acceptedAt) {
      throw conflict('invitationUsed');
    }
    if (invitation.revokedAt) {
      throw conflict('invitationRevoked');
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw conflict('invitationExpired');
    }

    // The invitation is for one address. Accepting it from a different account
    // would silently put the wrong person on the team.
    if (invitation.email.toLowerCase() !== actor.email.toLowerCase()) {
      throw forbidden('invitationWrongAccount', { email: invitation.email });
    }

    await tx.roleAssignment.upsert({
      where: {
        userId_role_businessId: {
          userId: actor.userId,
          role: invitation.role,
          businessId: invitation.businessId,
        },
      },
      create: {
        userId: actor.userId,
        role: invitation.role,
        businessId: invitation.businessId,
      },
      update: {},
    });

    if (invitation.staffMemberId) {
      // Only claim the staff row if it is still unclaimed.
      await tx.staffMember.updateMany({
        where: { id: invitation.staffMemberId, businessId: invitation.businessId, userId: null },
        data: { userId: actor.userId },
      });
    }

    await tx.staffInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date(), acceptedById: actor.userId },
    });

    return {
      businessName: invitation.business.name,
      businessSlug: invitation.business.slug,
      role: invitation.role,
    };
  });
}

async function sendInvitationEmail(input: {
  email: string;
  businessName: string;
  inviterName: string;
  token: string;
  expiresAt: Date;
  locale: Locale;
}) {
  const path = localePath(input.locale, `/invite?token=${encodeURIComponent(input.token)}`);
  const url = `${env.APP_URL}${path}`;
  const { email } = messagesFor(input.locale).feedback;
  const names = { inviter: input.inviterName, business: input.businessName };
  const date = input.expiresAt.toLocaleDateString(LOCALE_META[input.locale].intl);

  const result = await emailProvider.send({
    to: input.email,
    subject: interpolate(email.invitation.subject, names),
    text: [
      email.invitation.greeting,
      '',
      interpolate(email.invitation.intro, names),
      email.invitation.access,
      '',
      email.invitation.cta,
      '',
      url,
      '',
      interpolate(email.invitation.validity, { date }),
      email.invitation.ignore,
      '',
      email.signature,
    ].join('\n'),
  });

  if (!result.delivered) {
    logger.error('invitation email not delivered', { error: result.error });
  }
}
