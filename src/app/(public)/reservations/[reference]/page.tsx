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
import { formatDateTime, formatDuration, formatPhone, formatPrice } from '@/i18n/format';
import { getActor } from '@/server/auth/session';

export const metadata: Metadata = {
  title: 'Votre réservation',
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente de confirmation',
  CONFIRMED: 'Confirmé',
  COMPLETED: 'Terminé',
  CANCELLED_BY_CUSTOMER: 'Annulé par vous',
  CANCELLED_BY_BUSINESS: 'Annulé par l’établissement',
  RESCHEDULED: 'Reporté',
  NO_SHOW: 'Absence',
  EXPIRED: 'Expiré',
};

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
              <h1>Réservation confirmée</h1>
              <p>
                Votre rendez-vous est enregistré. Vous recevrez un rappel avant l’heure.
              </p>
            </>
          ) : (
            <>
              <h1>Votre réservation</h1>
              <p>Référence {reservation.reference}</p>
            </>
          )}
          <Badge tone={STATUS_TONE[reservation.status] ?? 'neutral'}>
            {STATUS_LABEL[reservation.status] ?? reservation.status}
          </Badge>
        </div>

        <div className="z-panel z-confirm__ticket">
          <div className="z-ticket__row">
            <span>Établissement</span>
            <strong>
              <Link href={`/business/${reservation.business.slug}`}>
                {reservation.business.name}
              </Link>
            </strong>
          </div>
          <div className="z-ticket__row">
            <span>Prestation</span>
            <strong>{service?.serviceName ?? '—'}</strong>
          </div>
          <div className="z-ticket__row">
            <span>Professionnel</span>
            <strong>{reservation.staffMember.displayName}</strong>
          </div>
          <div className="z-ticket__row">
            <span>Date et heure</span>
            <strong>
              {formatDateTime(reservation.startAt, 'fr', reservation.business.timezone)}
            </strong>
          </div>
          <div className="z-ticket__row">
            <span>Durée</span>
            <strong>{service ? formatDuration(service.durationMinutes) : '—'}</strong>
          </div>
          {reservation.business.location ? (
            <div className="z-ticket__row">
              <span>Adresse</span>
              <strong>
                {reservation.business.location.addressLine1},{' '}
                {reservation.business.location.city?.name}
              </strong>
            </div>
          ) : null}
          {reservation.business.phone ? (
            <div className="z-ticket__row">
              <span>Téléphone</span>
              <strong>
                <a href={`tel:${reservation.business.phone}`}>
                  {formatPhone(reservation.business.phone)}
                </a>
              </strong>
            </div>
          ) : null}

          <div className="z-ticket__perforation" aria-hidden="true" />

          <div className="z-ticket__row z-ticket__row--total">
            <span>Référence</span>
            <strong className="z-ticket__ref">{reservation.reference}</strong>
          </div>
          <div className="z-ticket__row z-ticket__row--total">
            <span>Total</span>
            <strong>
              {formatPrice(Number(reservation.totalAmount), 'fr', reservation.currency)}
            </strong>
          </div>
        </div>

        {reservation.status === 'PENDING' ? (
          <Alert tone="warning">
            L’établissement doit encore confirmer ce rendez-vous. Vous recevrez une
            notification dès que c’est fait.
          </Alert>
        ) : null}

        <div className="z-confirm__actions">
          <AddToCalendar
            title={`${service?.serviceName ?? 'Rendez-vous'} — ${reservation.business.name}`}
            startAt={reservation.startAt.toISOString()}
            endAt={reservation.endAt.toISOString()}
            location={
              reservation.business.location
                ? `${reservation.business.location.addressLine1}, ${reservation.business.location.city?.name ?? ''}`
                : reservation.business.name
            }
            description={`Référence ${reservation.reference}`}
          />
          <ButtonLink href={`/business/${reservation.business.slug}`} variant="secondary">
            Voir l’établissement
          </ButtonLink>
          <ButtonLink href="/account" variant="ghost">
            Mes rendez-vous
          </ButtonLink>
        </div>

        {isCustomer ? (
          <ReservationActions
            reservationId={reservation.id}
            businessSlug={reservation.business.slug}
            canCancel={cancelCheck.allowed}
            cancelReason={cancelCheck.allowed ? null : cancelCheck.reason}
            canReschedule={rescheduleCheck.allowed}
            rescheduleReason={rescheduleCheck.allowed ? null : rescheduleCheck.reason}
          />
        ) : null}
      </div>
    </div>
  );
}
