import type { NotificationType } from '@prisma/client';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { emailProvider, smsProvider } from '../providers/notifications';

/**
 * Notification service.
 *
 * In-app notifications are real rows the user sees. Email and SMS go through
 * provider interfaces whose development implementations log the exact message
 * that production would send. A user's per-type, per-channel preferences are
 * honoured before anything is dispatched.
 */

type Recipient = { userId: string; email?: string | null; phone?: string | null };

async function channelsFor(userId: string, type: NotificationType) {
  const prefs = await db.notificationPreference.findMany({
    where: { userId, type },
    select: { channel: true, enabled: true },
  });
  const disabled = new Set(prefs.filter((p) => !p.enabled).map((p) => p.channel));
  return {
    inApp: !disabled.has('IN_APP'),
    email: !disabled.has('EMAIL'),
    sms: disabled.has('SMS') ? false : false, // SMS is opt-in; off until a provider is contracted
  };
}

export async function dispatch(opts: {
  recipient: Recipient;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
}) {
  const channels = await channelsFor(opts.recipient.userId, opts.type);

  if (channels.inApp) {
    await db.notification.create({
      data: {
        userId: opts.recipient.userId,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        link: opts.link ?? null,
        metadata: (opts.metadata ?? {}) as object,
      },
    });
  }

  if (channels.email && opts.recipient.email) {
    const result = await emailProvider.send({
      to: opts.recipient.email,
      subject: opts.title,
      text: `${opts.body}${opts.link ? `\n\n${env.APP_URL}${opts.link}` : ''}`,
    });
    if (!result.delivered) {
      logger.warn('email delivery failed', { type: opts.type, error: result.error });
    }
  }

  if (channels.sms && opts.recipient.phone) {
    await smsProvider.send({ to: opts.recipient.phone, text: `${opts.title}. ${opts.body}` });
  }
}

async function recipientOf(userId: string): Promise<Recipient | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, phone: true },
  });
  return user ? { userId: user.id, email: user.email, phone: user.phone } : null;
}

function formatWhen(startAt: Date, timezone: string, locale = 'fr-FR'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(startAt);
}

/** Reminders at the configured offsets before the appointment. */
export async function scheduleReminders(reservationId: string, startAt: Date) {
  const setting = await db.platformSetting.findUnique({
    where: { key: 'notifications.reminderOffsetsHours' },
  });
  const offsets = Array.isArray(setting?.value)
    ? (setting.value as number[])
    : [24, 2];

  const rows = offsets
    .map((hours) => new Date(startAt.getTime() - hours * 3_600_000))
    .filter((sendAt) => sendAt.getTime() > Date.now())
    .map((sendAt) => ({
      reservationId,
      type: 'RESERVATION_REMINDER' as NotificationType,
      sendAt,
    }));

  if (rows.length > 0) {
    await db.scheduledNotification.createMany({ data: rows, skipDuplicates: true });
  }
}

export const notify = {
  async reservationCreated(reservationId: string) {
    const reservation = await db.reservation.findUnique({
      where: { id: reservationId },
      include: {
        business: { select: { name: true, slug: true, timezone: true, ownerId: true } },
        items: { select: { serviceName: true } },
        staffMember: { select: { displayName: true } },
      },
    });
    if (!reservation) return;

    const when = formatWhen(reservation.startAt, reservation.business.timezone);
    const service = reservation.items[0]?.serviceName ?? 'your appointment';

    if (reservation.customerId) {
      const recipient = await recipientOf(reservation.customerId);
      if (recipient) {
        await dispatch({
          recipient,
          type: 'RESERVATION_CREATED',
          title: `Appointment booked — ${reservation.business.name}`,
          body: `${service} with ${reservation.staffMember.displayName} on ${when}. Reference ${reservation.reference}.`,
          link: `/reservations/${reservation.reference}`,
        });
      }
    }

    const owner = await recipientOf(reservation.business.ownerId);
    if (owner) {
      await dispatch({
        recipient: owner,
        type: 'RESERVATION_CREATED',
        title: 'New booking',
        body: `${service} with ${reservation.staffMember.displayName} on ${when}.`,
        link: `/pro/dashboard/reservations`,
      });
    }
  },

  async reservationTransitioned(reservationId: string, to: NotificationType | string) {
    const map: Record<string, NotificationType> = {
      CONFIRMED: 'RESERVATION_CONFIRMED',
      COMPLETED: 'RESERVATION_COMPLETED',
      CANCELLED_BY_CUSTOMER: 'RESERVATION_CANCELLED',
      CANCELLED_BY_BUSINESS: 'RESERVATION_CANCELLED',
      RESCHEDULED: 'RESERVATION_RESCHEDULED',
    };
    const type = map[to as string];
    if (!type) return;

    const reservation = await db.reservation.findUnique({
      where: { id: reservationId },
      include: { business: { select: { name: true, timezone: true, ownerId: true } } },
    });
    if (!reservation) return;

    const when = formatWhen(reservation.startAt, reservation.business.timezone);
    const titles: Record<NotificationType, string> = {
      RESERVATION_CONFIRMED: `Appointment confirmed — ${reservation.business.name}`,
      RESERVATION_COMPLETED: `Thanks for visiting ${reservation.business.name}`,
      RESERVATION_CANCELLED: `Appointment cancelled — ${reservation.business.name}`,
      RESERVATION_RESCHEDULED: `Appointment moved — ${reservation.business.name}`,
    } as Record<NotificationType, string>;

    const bodies: Record<string, string> = {
      RESERVATION_CONFIRMED: `Your appointment on ${when} is confirmed. Reference ${reservation.reference}.`,
      RESERVATION_COMPLETED: `How did it go? Leave a review to help other customers.`,
      RESERVATION_CANCELLED: `Your appointment on ${when} has been cancelled.`,
      RESERVATION_RESCHEDULED: `Your appointment has been moved.`,
    };

    if (reservation.customerId) {
      const recipient = await recipientOf(reservation.customerId);
      if (recipient) {
        await dispatch({
          recipient,
          type,
          title: titles[type] ?? 'Appointment update',
          body: bodies[to as string] ?? 'Your appointment was updated.',
          link: `/reservations/${reservation.reference}`,
        });
      }
    }
  },

  async reviewReceived(businessOwnerId: string, businessName: string, rating: number) {
    const recipient = await recipientOf(businessOwnerId);
    if (!recipient) return;
    await dispatch({
      recipient,
      type: 'REVIEW_RECEIVED',
      title: `New ${rating}-star review`,
      body: `A customer reviewed ${businessName}.`,
      link: '/pro/dashboard/reviews',
    });
  },

  async businessModerated(
    ownerId: string,
    businessName: string,
    outcome: 'APPROVED' | 'REJECTED' | 'SUSPENDED',
    note?: string,
  ) {
    const recipient = await recipientOf(ownerId);
    if (!recipient) return;
    const type: NotificationType =
      outcome === 'APPROVED'
        ? 'BUSINESS_APPROVED'
        : outcome === 'REJECTED'
          ? 'BUSINESS_REJECTED'
          : 'BUSINESS_SUSPENDED';
    const body =
      outcome === 'APPROVED'
        ? `${businessName} is now live on Zynetna.`
        : outcome === 'REJECTED'
          ? `${businessName} was not approved. ${note ?? ''}`.trim()
          : `${businessName} has been suspended. ${note ?? ''}`.trim();
    await dispatch({
      recipient,
      type,
      title: `${businessName} — ${outcome.toLowerCase()}`,
      body,
      link: '/pro/dashboard',
    });
  },

  async trialEnding(ownerId: string, businessName: string, daysLeft: number) {
    const recipient = await recipientOf(ownerId);
    if (!recipient) return;
    await dispatch({
      recipient,
      type: 'TRIAL_ENDING',
      title: daysLeft <= 0 ? 'Your free trial has ended' : `Your free trial ends in ${daysLeft} days`,
      body: `Keep ${businessName} visible on Zynetna by activating your subscription.`,
      link: '/pro/dashboard/subscription',
    });
  },

  async subscriptionExpired(ownerId: string, businessName: string) {
    const recipient = await recipientOf(ownerId);
    if (!recipient) return;
    await dispatch({
      recipient,
      type: 'SUBSCRIPTION_EXPIRED',
      title: 'Subscription expired',
      body: `${businessName} is no longer listed and cannot take new bookings. Existing appointments are unaffected.`,
      link: '/pro/dashboard/subscription',
    });
  },
};

/** Dispatch due reminders — called by the scheduled job. */
export async function runDueReminders(now = new Date()) {
  const due = await db.scheduledNotification.findMany({
    where: { status: 'PENDING', sendAt: { lte: now } },
    include: {
      reservation: {
        include: {
          business: { select: { name: true, timezone: true } },
          items: { select: { serviceName: true } },
          staffMember: { select: { displayName: true } },
        },
      },
    },
    take: 200,
  });

  let sent = 0;
  for (const row of due) {
    const reservation = row.reservation;
    // Cancelled appointments must not produce reminders.
    if (!['PENDING', 'CONFIRMED'].includes(reservation.status)) {
      await db.scheduledNotification.update({
        where: { id: row.id },
        data: { status: 'CANCELLED' },
      });
      continue;
    }
    try {
      if (reservation.customerId) {
        const recipient = await recipientOf(reservation.customerId);
        if (recipient) {
          await dispatch({
            recipient,
            type: 'RESERVATION_REMINDER',
            title: `Reminder — ${reservation.business.name}`,
            body: `${reservation.items[0]?.serviceName ?? 'Your appointment'} with ${
              reservation.staffMember.displayName
            } on ${formatWhen(reservation.startAt, reservation.business.timezone)}.`,
            link: `/reservations/${reservation.reference}`,
          });
        }
      }
      await db.scheduledNotification.update({
        where: { id: row.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
      sent += 1;
    } catch (error) {
      await db.scheduledNotification.update({
        where: { id: row.id },
        data: { status: 'FAILED', error: (error as Error).message.slice(0, 500) },
      });
    }
  }

  logger.info('reminders dispatched', { due: due.length, sent });
  return { due: due.length, sent };
}

/**
 * Password reset link. Sent through the same email provider as everything
 * else, so a production SMTP driver covers it without a second code path.
 */
export async function sendPasswordResetEmail(input: {
  email: string;
  firstName: string;
  token: string;
}) {
  const url = `${env.APP_URL}/reset-password?token=${encodeURIComponent(input.token)}`;

  const result = await emailProvider.send({
    to: input.email,
    subject: 'Réinitialiser votre mot de passe Zynetna',
    text: [
      `Bonjour ${input.firstName},`,
      '',
      'Vous avez demandé à réinitialiser votre mot de passe Zynetna.',
      'Ce lien est valable une heure et ne peut servir qu’une seule fois :',
      '',
      url,
      '',
      'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message —',
      'votre mot de passe actuel reste valable.',
      '',
      'Zynetna — Réserve ta chaise. Réserve ton éclat.',
    ].join('\n'),
  });

  if (!result.delivered) {
    logger.error('password reset email not delivered', { error: result.error });
  }
}
