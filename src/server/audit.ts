import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { Actor } from '@/domain/identity/actor';

/**
 * Audit trail for consequential actions.
 *
 * Answers: who did what, when, to which object. Writes are best-effort — an
 * audit failure must never roll back the action it describes — but they are
 * logged loudly when they fail.
 */
export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.password_changed'
  | 'auth.password_reset'
  | 'auth.2fa_enabled'
  | 'auth.2fa_disabled'
  | 'auth.2fa_recovery_codes'
  | 'auth.2fa_recovery_used'
  | 'auth.2fa_reset'
  | 'business.created'
  | 'business.updated'
  | 'business.published'
  | 'business.approved'
  | 'business.rejected'
  | 'business.verified'
  | 'business.suspended'
  | 'business.reactivated'
  | 'user.updated'
  | 'user.suspended'
  | 'user.reactivated'
  | 'user.role_granted'
  | 'user.role_revoked'
  | 'invitation.created'
  | 'invitation.revoked'
  | 'invitation.accepted'
  | 'reservation.created'
  | 'reservation.confirmed'
  | 'reservation.cancelled'
  | 'reservation.rescheduled'
  | 'reservation.completed'
  | 'reservation.no_show'
  | 'review.moderated'
  | 'report.resolved'
  | 'category.created'
  | 'category.updated'
  | 'category.deleted'
  | 'subscription.changed'
  | 'subscription.plan_updated'
  | 'payment.recorded'
  | 'setting.updated'
  | 'flag.updated'
  | 'media.deleted';

export async function recordAudit(input: {
  actor?: Actor | null;
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  businessId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actor?.userId ?? null,
        actorEmail: input.actor?.email ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        businessId: input.businessId ?? null,
        metadata: (input.metadata ?? {}) as object,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (error) {
    logger.error('audit write failed', {
      action: input.action,
      targetId: input.targetId,
      error: (error as Error).message,
    });
  }
}
