import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { getReservationByReference } from '@/server/actions/booking';
import { ReservationActions } from '@/components/booking/ReservationActions';
import { SuccessBurst } from '@/components/booking/SuccessBurst';
import { AddToCalendar } from '@/components/booking/AddToCalendar';
import { canCustomerCancel, canCustomerReschedule } from '@/domain/booking/policy';
import {
  formatDateTime,
  formatDuration,
  formatPhone,
  formatPrice,
  localizedName,
  policyMessage,
} from '@/i18n/format';
import { getActor } from '@/server/auth/session';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.booking.yourReservation, robots: { index: false, follow: false } };
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'accent'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  COMPLETED: 'accent',
  CANCELLED_BY_CUSTOMER: 'danger',
  CANCELLED_BY_BUSINESS: 'danger',
  RESCHEDULED: 'neutral',
  NO_SHOW: 'danger',
  EXPIRED: 'neutral',
};

export default async function ReservationPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { reference } = await params;
  const { new: isNew } = await searchParams;
  const { m, t, locale, path } = await translate();

  // Two statuses read differently from the customer's side than from the
  // business's: "awaiting confirmation" and "cancelled by you".
  const statusLabel: Record<string, string> = {
    ...m.status,
    PENDING: m.booking.statusPendingLong,
    CANCELLED_BY_CUSTOMER: m.booking.statusCancelledByYou,
  };

  const reservation = await getReservationByReference(reference).catch(() => null);
  if (!reservation) notFound();

  const actor = await getActor();
  const isCustomer = actor?.userId === reservation.customerId;
  const now = new Date();
  const policy = {
    minNoticeMinutes: reservation.business.minNoticeMinutes,
    maxAdvanceDays: reservation.business.maxAdvanceDays,
    cancellationWindowHours: reservation.business.cancellationWindowHours,
    allowCustomerCancel: reservation.business.allowCustomerCancel,
    allowCustomerReschedule: reservation.business.allowCustomerReschedule,
  };

  const cancelCheck = canCustomerCancel(reservation, policy, now);
  const rescheduleCheck = canCustomerReschedule(reservation, policy, now);
  const service = reservation.items[0];

  return (
    <div className="z-confirm">
      <div className="z-container z-confirm__inner">
        {isNew ? <SuccessBurst /> : null}

        <div className="z-confirm__head">
          {isNew ? (
            <>
              <h1>{m.booking.confirmed}</h1>
              <p>{m.booking.confirmedBody}</p>
            </>
          ) : (
            <>
              <h1>{m.booking.yourReservation}</h1>
              <p>{t(m.booking.referenceIs, { reference: reservation.reference })}</p>
            </>
          )}
          <Badge tone={STATUS_TONE[reservation.status] ?? 'neutral'}>
            {statusLabel[reservation.status] ?? reservation.status}
          </Badge>
        </div>

        <div className="z-panel z-confirm__ticket">
          <div className="z-ticket__row">
            <span>{m.booking.businessLabel}</span>
            <strong>
              <Link href={path(`/business/${reservation.business.slug}`)}>
                {reservation.business.name}
              </Link>
            </strong>
          </div>
          <div className="z-ticket__row">
            <span>{m.booking.stepService}</span>
            <strong>{service?.serviceName ?? '—'}</strong>
          </div>
          <div className="z-ticket__row">
            <span>{m.booking.stepStaff}</span>
            <strong>{reservation.staffMember.displayName}</strong>
          </div>
          <div className="z-ticket__row">
            <span>{m.booking.stepTime}</span>
            <strong>
              {formatDateTime(reservation.startAt, locale, reservation.business.timezone)}
            </strong>
          </div>
          <div className="z-ticket__row">
            <span>{m.booking.duration}</span>
            <strong>{service ? formatDuration(service.durationMinutes, locale) : '—'}</strong>
          </div>
          {reservation.business.location ? (
            <div className="z-ticket__row">
              <span>{m.booking.address}</span>
              <strong>
                {reservation.business.location.addressLine1},{' '}
                {reservation.business.location.city
                  ? localizedName(reservation.business.location.city, locale)
                  : null}
              </strong>
            </div>
          ) : null}
          {reservation.business.phone ? (
            <div className="z-ticket__row">
              <span>{m.booking.phone}</span>
              <strong>
                <a href={`tel:${reservation.business.phone}`}>
                  {formatPhone(reservation.business.phone)}
                </a>
              </strong>
            </div>
          ) : null}

          <div className="z-ticket__perforation" aria-hidden="true" />

          <div className="z-ticket__row z-ticket__row--total">
            <span>{m.booking.reference}</span>
            <strong className="z-ticket__ref">{reservation.reference}</strong>
          </div>
          <div className="z-ticket__row z-ticket__row--total">
            <span>{m.booking.total}</span>
            <strong>
              {formatPrice(Number(reservation.totalAmount), locale, reservation.currency)}
            </strong>
          </div>
        </div>

        {reservation.status === 'PENDING' ? (
          <Alert tone="warning">{m.booking.pendingNotice}</Alert>
        ) : null}

        <div className="z-confirm__actions">
          <AddToCalendar
            title={`${service?.serviceName ?? m.booking.appointment} — ${reservation.business.name}`}
            startAt={reservation.startAt.toISOString()}
            endAt={reservation.endAt.toISOString()}
            location={
              reservation.business.location
                ? `${reservation.business.location.addressLine1}, ${reservation.business.location.city?.name ?? ''}`
                : reservation.business.name
            }
            description={t(m.booking.referenceIs, { reference: reservation.reference })}
          />
          <ButtonLink href={path(`/business/${reservation.business.slug}`)} variant="secondary">
            {m.booking.seeBusiness}
          </ButtonLink>
          <ButtonLink href={path('/account')} variant="ghost">
            {m.booking.myAppointments}
          </ButtonLink>
        </div>

        {isCustomer ? (
          <ReservationActions
            reservationId={reservation.id}
            canCancel={cancelCheck.allowed}
            cancelReason={
              cancelCheck.allowed ? null : policyMessage(cancelCheck.reason, m.policy)
            }
            canReschedule={rescheduleCheck.allowed}
            rescheduleReason={
              rescheduleCheck.allowed ? null : policyMessage(rescheduleCheck.reason, m.policy)
            }
            m={m.booking}
            bookPath={path(`/business/${reservation.business.slug}/book`)}
          />
        ) : null}
      </div>
    </div>
  );
}
