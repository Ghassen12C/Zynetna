import 'server-only';
import type { NotificationChannel, NotificationType } from '@prisma/client';
import { db } from '@/lib/db';
import type { Actor } from '@/domain/identity/actor';
import { tenantIds } from '@/domain/identity/actor';

/**
 * Notification preferences.
 *
 * Stored sparsely: a row exists only where someone has turned something off,
 * so a new notification type is on by default for everyone without a backfill.
 * `channelsFor` in the notification service reads the same rows.
 */

/** What a customer hears about. */
export const CUSTOMER_TYPES: readonly NotificationType[] = [
  'RESERVATION_CONFIRMED',
  'RESERVATION_CANCELLED',
  'RESERVATION_RESCHEDULED',
  'RESERVATION_REMINDER',
  'RESERVATION_COMPLETED',
  'REVIEW_RESPONSE',
];

/** What a business owner hears about, on top of the customer set. */
export const BUSINESS_TYPES: readonly NotificationType[] = [
  'RESERVATION_CREATED',
  'REVIEW_RECEIVED',
  'BUSINESS_APPROVED',
  'BUSINESS_REJECTED',
  'BUSINESS_SUSPENDED',
  'TRIAL_ENDING',
  'SUBSCRIPTION_EXPIRED',
  'SUBSCRIPTION_RENEWED',
  'PAYMENT_REJECTED',
];

/**
 * Notifications whose in-app copy cannot be switched off.
 *
 * A customer who silences "your appointment was cancelled" turns up to a
 * salon that is not expecting them. In-app costs nothing and interrupts
 * nobody, so it stays; email remains theirs to decide.
 */
export const ALWAYS_IN_APP: readonly NotificationType[] = [
  'RESERVATION_CANCELLED',
  'RESERVATION_RESCHEDULED',
];

/** Channels a person can actually choose between today. */
export const CHOOSABLE_CHANNELS: readonly NotificationChannel[] = ['IN_APP', 'EMAIL'];

export type PreferenceRow = {
  type: NotificationType;
  inApp: boolean;
  email: boolean;
  /** In-app is fixed on for this type. */
  inAppLocked: boolean;
};

export function typesFor(actor: Actor): NotificationType[] {
  const types = [...CUSTOMER_TYPES];
  if (tenantIds(actor).length > 0) types.push(...BUSINESS_TYPES);
  return types;
}

export async function getPreferences(actor: Actor): Promise<PreferenceRow[]> {
  const types = typesFor(actor);
  const rows = await db.notificationPreference.findMany({
    where: { userId: actor.userId, type: { in: types } },
    select: { type: true, channel: true, enabled: true },
  });

  // Absent means on, which is why only the exceptions are stored.
  const off = new Set(rows.filter((r) => !r.enabled).map((r) => `${r.type}:${r.channel}`));

  return types.map((type) => ({
    type,
    inApp: ALWAYS_IN_APP.includes(type) ? true : !off.has(`${type}:IN_APP`),
    email: !off.has(`${type}:EMAIL`),
    inAppLocked: ALWAYS_IN_APP.includes(type),
  }));
}

export async function setPreference(input: {
  actor: Actor;
  type: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}) {
  // Only the types this person actually receives, so a crafted request cannot
  // write rows for notifications that are none of their business.
  if (!typesFor(input.actor).includes(input.type)) {
    return { changed: false };
  }
  if (!CHOOSABLE_CHANNELS.includes(input.channel)) {
    return { changed: false };
  }
  // A locked in-app notice stays on whatever the request says.
  if (input.channel === 'IN_APP' && ALWAYS_IN_APP.includes(input.type) && !input.enabled) {
    return { changed: false };
  }

  await db.notificationPreference.upsert({
    where: {
      userId_type_channel: {
        userId: input.actor.userId,
        type: input.type,
        channel: input.channel,
      },
    },
    create: {
      userId: input.actor.userId,
      type: input.type,
      channel: input.channel,
      enabled: input.enabled,
    },
    update: { enabled: input.enabled },
  });

  return { changed: true };
}
