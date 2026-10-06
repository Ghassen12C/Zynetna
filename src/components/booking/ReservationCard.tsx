import Link from 'next/link';
import { Badge } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import { formatDateTime, formatDuration, formatPrice } from '@/i18n/format';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente',
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

export type ReservationCardData = {
  id: string;
  reference: string;
  status: string;
  startAt: Date;
  totalAmount: unknown;
  currency: string;
  logoUrl: string | null;
  business: {
    slug: string;
    name: string;
    timezone: string;
    location: { addressLine1: string; city: { name: string } | null } | null;
  };
  staffMember: { displayName: string };
  items: { serviceName: string; durationMinutes: number }[];
  review?: { id: string; rating: number } | null;
};

export function ReservationCard({
  reservation,
  showReviewPrompt = false,
}: {
  reservation: ReservationCardData;
  showReviewPrompt?: boolean;
}) {
  const service = reservation.items[0];

  return (
    <article className="z-rcard">
      <div className="z-rcard__logo">
        {reservation.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reservation.logoUrl} alt="" loading="lazy" />
        ) : (
          <svg viewBox="0 0 100 138" width="22" aria-hidden="true">
            <path
              d="M0 50a50 50 0 0 1 100 0v80a8 8 0 0 1-8 8H8a8 8 0 0 1-8-8V50Z"
              fill="var(--z-medina)"
            />
          </svg>
        )}
      </div>

      <div className="z-rcard__body">
        <div className="z-rcard__top">
          <Link href={`/business/${reservation.business.slug}`} className="z-rcard__business">
            {reservation.business.name}
          </Link>
          <Badge tone={STATUS_TONE[reservation.status] ?? 'neutral'}>
            {STATUS_LABEL[reservation.status] ?? reservation.status}
          </Badge>
        </div>

        <p className="z-rcard__service">
          {service?.serviceName ?? '—'}
          {service ? ` · ${formatDuration(service.durationMinutes)}` : ''} · avec{' '}
          {reservation.staffMember.displayName}
        </p>

        <p className="z-rcard__when">
          {formatDateTime(reservation.startAt, 'fr', reservation.business.timezone)}
        </p>

        {reservation.business.location ? (
          <p className="z-rcard__where">
            {reservation.business.location.addressLine1}
            {reservation.business.location.city ? `, ${reservation.business.location.city.name}` : ''}
          </p>
        ) : null}
      </div>

      <div className="z-rcard__aside">
        <span className="z-rcard__price">
          {formatPrice(Number(reservation.totalAmount), 'fr', reservation.currency)}
        </span>
        <ButtonLink
          href={`/reservations/${reservation.reference}`}
          variant="secondary"
          size="sm"
        >
          Détails
        </ButtonLink>
        {showReviewPrompt && reservation.status === 'COMPLETED' && !reservation.review ? (
          <ButtonLink href={`/account/reviews?reservation=${reservation.id}`} size="sm">
            Laisser un avis
          </ButtonLink>
        ) : null}
      </div>
    </article>
  );
}
