import type { NotificationType } from '@prisma/client';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { emailProvider, smsProvider } from '../providers/notifications';
import { DEFAULT_LOCALE, LOCALE_META, type Locale, isLocale, localePath } from '@/i18n/config';
import { interpolate } from '@/i18n/interpolate';
import { type Messages, messagesFor } from '@/i18n';

/**
 * Notification service.
 *
 * In-app notifications are real rows the user sees. Email and SMS go through
 * provider interfaces whose development implementations log the exact message
 * that production would send. A user's per-type, per-channel preferences are
 * honoured before anything is dispatched.
 */

type Recipient = {
  userId: string;
  email?: string | null;
  phone?: string | null;
  /** The language this person reads. Absent falls back to the default. */
  locale?: string | null;
};

/**
 * A message, written at dispatch time in the recipient's own language.
 *
 * The notification text is persisted, so it has to be rendered before it is
 * stored rather than translated on display — and it is the same text that goes
 * out by email, where there is no interface to re-render it in.
 */
type Render = (
  m: Messages,
  t: (template: string, params?: Record<string, string | number>) => string,
  locale: Locale,
) => { title: string; body: string };

function localeOf(recipient: Recipient): Locale {
  return recipient.locale && isLocale(recipient.locale) ? recipient.locale : DEFAULT_LOCALE;
}

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
  /** Either finished text, or a renderer run in the recipient's language. */
  title?: string;
  body?: string;
  render?: Render;
  link?: string;
  metadata?: Record<string, unknown>;
}) {
  const channels = await channelsFor(opts.recipient.userId, opts.type);

  const locale = localeOf(opts.recipient);
  const rendered = opts.render
    ? opts.render(messagesFor(locale), interpolate, locale)
    : { title: opts.title ?? '', body: opts.body ?? '' };
  const { title, body } = rendered;

  if (channels.inApp) {
    await db.notification.create({
      data: {
        userId: opts.recipient.userId,
        type: opts.type,
        title,
        body,
        link: opts.link ?? null,
        metadata: (opts.metadata ?? {}) as object,
      },
    });
  }

  if (channels.email && opts.recipient.email) {
    const result = await emailProvider.send({
      to: opts.recipient.email,
      subject: title,
      text: `${body}${opts.link ? `\n\n${env.APP_URL}${opts.link}` : ''}`,
    });
    if (!result.delivered) {
      logger.warn('email delivery failed', { type: opts.type, error: result.error });
    }
  }

  if (channels.sms && opts.recipient.phone) {
    await smsProvider.send({ to: opts.recipient.phone, text: `${title}. ${body}` });
  }
}

async function recipientOf(userId: string): Promise<Recipient | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, phone: true, locale: true },
  });
  return user
    ? { userId: user.id, email: user.email, phone: user.phone, locale: user.locale }
    : null;
}

function formatWhen(startAt: Date, timezone: string, locale: Locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(LOCALE_META[locale].intl, {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    // Tunisia reads the 24-hour clock in every one of these languages; the
    // Arabic and English locales would otherwise render "09:00 ص" / "09:00 AM".
    hour12: false,
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

    const staff = reservation.staffMember.displayName;
    const named = reservation.items[0]?.serviceName ?? null;

    if (reservation.customerId) {
      const recipient = await recipientOf(reservation.customerId);
      if (recipient) {
        await dispatch({
          recipient,
          type: 'RESERVATION_CREATED',
          link: `/reservations/${reservation.reference}`,
          render: (m, t, locale) => ({
            title: t(m.notify.bookedTitle, { business: reservation.business.name }),
            body: t(m.notify.bookedBody, {
              service: named ?? m.notify.yourAppointment,
              staff,
              when: formatWhen(reservation.startAt, reservation.business.timezone, locale),
              reference: reservation.reference,
            }),
          }),
        });
      }
    }

    const owner = await recipientOf(reservation.business.ownerId);
    if (owner) {
      await dispatch({
        recipient: owner,
        type: 'RESERVATION_CREATED',
        link: `/pro/dashboard/reservations`,
        render: (m, t, locale) => ({
          title: m.notify.newBookingTitle,
          body: t(m.notify.newBookingBody, {
            service: named ?? m.notify.yourAppointment,
            staff,
            when: formatWhen(reservation.startAt, reservation.business.timezone, locale),
          }),
        }),
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

    if (!reservation.customerId) return;
    const recipient = await recipientOf(reservation.customerId);
    if (!recipient) return;

    await dispatch({
      recipient,
      type,
      link: `/reservations/${reservation.reference}`,
      render: (m, t, locale) => {
        const business = reservation.business.name;
        const when = formatWhen(reservation.startAt, reservation.business.timezone, locale);
        const reference = reservation.reference;

        switch (type) {
          case 'RESERVATION_CONFIRMED':
            return {
              title: t(m.notify.confirmedTitle, { business }),
              body: t(m.notify.confirmedBody, { when, reference }),
            };
          case 'RESERVATION_COMPLETED':
            return {
              title: t(m.notify.completedTitle, { business }),
              body: m.notify.completedBody,
            };
          case 'RESERVATION_CANCELLED':
            return {
              title: t(m.notify.cancelledTitle, { business }),
              body: t(m.notify.cancelledBody, { when }),
            };
          case 'RESERVATION_RESCHEDULED':
            return {
              title: t(m.notify.movedTitle, { business }),
              body: m.notify.movedBody,
            };
          default:
            return { title: m.notify.updatedTitle, body: m.notify.updatedBody };
        }
      },
    });
  },

  async reviewReceived(businessOwnerId: string, businessName: string, rating: number) {
    const recipient = await recipientOf(businessOwnerId);
    if (!recipient) return;
    await dispatch({
      recipient,
      type: 'REVIEW_RECEIVED',
      link: '/pro/dashboard/reviews',
      render: (m, t) => ({
        title: t(m.notify.reviewTitle, { rating }),
        body: t(m.notify.reviewBody, { business: businessName }),
      }),
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
    await dispatch({
      recipient,
      type,
      link: '/pro/dashboard',
      render: (m, t) => {
        const body =
          outcome === 'APPROVED'
            ? t(m.notify.moderatedApprovedBody, { business: businessName })
            : outcome === 'REJECTED'
              ? t(m.notify.moderatedRejectedBody, { business: businessName })
              : t(m.notify.moderatedSuspendedBody, { business: businessName });
        return {
          title: t(m.notify.moderatedTitle, {
            business: businessName,
            outcome: m.notify[`outcome${outcome}`],
          }),
          // The moderator's own note is their words, appended as written.
          body: note ? `${body} ${note}` : body,
        };
      },
    });
  },

  async trialEnding(ownerId: string, businessName: string, daysLeft: number) {
    const recipient = await recipientOf(ownerId);
    if (!recipient) return;
    await dispatch({
      recipient,
      type: 'TRIAL_ENDING',
      link: '/pro/dashboard/subscription',
      render: (m, t) => ({
        title:
          daysLeft <= 0
            ? m.notify.trialEndedTitle
            : t(m.notify.trialEndingTitle, { days: daysLeft }),
        body: t(m.notify.trialBody, { business: businessName }),
      }),
    });
  },

  async subscriptionExpired(ownerId: string, businessName: string) {
    const recipient = await recipientOf(ownerId);
    if (!recipient) return;
    await dispatch({
      recipient,
      type: 'SUBSCRIPTION_EXPIRED',
      link: '/pro/dashboard/subscription',
      render: (m, t) => ({
        title: m.notify.subscriptionExpiredTitle,
        body: t(m.notify.subscriptionExpiredBody, { business: businessName }),
      }),
    });
  },

  /** A business sent a D17 payment: every platform admin is told. */
  async paymentSubmitted(businessName: string, amount: string) {
    const admins = await db.roleAssignment.findMany({
      where: { role: 'SUPER_ADMIN', businessId: null },
      select: { userId: true },
    });
    for (const { userId } of admins) {
      const recipient = await recipientOf(userId);
      if (!recipient) continue;
      await dispatch({
        recipient,
        type: 'PAYMENT_SUBMITTED',
        link: '/admin/subscriptions',
        render: (m, t) => ({
          title: t(m.notify.paymentSubmittedTitle, { business: businessName }),
          body: t(m.notify.paymentSubmittedBody, { business: businessName, amount }),
        }),
      });
    }
  },

  async paymentConfirmed(ownerId: string, businessName: string, until: Date) {
    const recipient = await recipientOf(ownerId);
    if (!recipient) return;
    await dispatch({
      recipient,
      type: 'SUBSCRIPTION_RENEWED',
      link: '/pro/dashboard/subscription',
      render: (m, t, locale) => ({
        title: m.notify.paymentConfirmedTitle,
        body: t(m.notify.paymentConfirmedBody, {
          business: businessName,
          date: new Intl.DateTimeFormat(LOCALE_META[locale].intl, { dateStyle: 'long' }).format(until),
        }),
      }),
    });
  },

  async paymentRejected(ownerId: string, businessName: string, reason: string) {
    const recipient = await recipientOf(ownerId);
    if (!recipient) return;
    await dispatch({
      recipient,
      type: 'PAYMENT_REJECTED',
      link: '/pro/dashboard/subscription',
      render: (m, t) => ({
        title: m.notify.paymentRejectedTitle,
        body: t(m.notify.paymentRejectedBody, { business: businessName, reason }),
      }),
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
            link: `/reservations/${reservation.reference}`,
            render: (m, t, locale) => ({
              title: t(m.notify.reminderTitle, { business: reservation.business.name }),
              body: t(m.notify.reminderBody, {
                service: reservation.items[0]?.serviceName ?? m.notify.yourAppointment,
                staff: reservation.staffMember.displayName,
                when: formatWhen(reservation.startAt, reservation.business.timezone, locale),
              }),
            }),
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
  /** The account's saved language; absent falls back to the default. */
  locale?: string | null;
}) {
  const locale: Locale = input.locale && isLocale(input.locale) ? input.locale : DEFAULT_LOCALE;
  const path = localePath(locale, `/reset-password?token=${encodeURIComponent(input.token)}`);
  const url = `${env.APP_URL}${path}`;
  const { email } = messagesFor(locale).feedback;

  const result = await emailProvider.send({
    to: input.email,
    subject: email.passwordReset.subject,
    text: [
      interpolate(email.passwordReset.greeting, { name: input.firstName }),
      '',
      email.passwordReset.intro,
      email.passwordReset.validity,
      '',
      url,
      '',
      email.passwordReset.ignore,
      '',
      email.signature,
    ].join('\n'),
  });

  if (!result.delivered) {
    logger.error('password reset email not delivered', { error: result.error });
  }
}
