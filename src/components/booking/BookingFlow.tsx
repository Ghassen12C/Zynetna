'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Primitives';
import { Skeleton } from '@/components/ui/Primitives';
import { createReservationAction, fetchAvailabilityAction } from '@/server/actions/booking';
import { addDays } from '@/domain/scheduling/time';
import { formatDuration, formatPrice } from '@/i18n/format';

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
  categoryName: string | null;
  imageUrl: string | null;
  staffIds: string[];
};

type Staff = {
  id: string;
  displayName: string;
  title: string | null;
  avatarUrl: string | null;
  isBookable: boolean;
  serviceIds: string[];
};

type Business = {
  id: string;
  slug: string;
  name: string;
  currency: string;
  timezone: string;
  maxAdvanceDays: number;
  minNoticeMinutes: number;
  cancellationWindowHours: number;
  cancellationPolicy: string | null;
  autoConfirm: boolean;
  logoUrl: string | null;
  addressLine: string | null;
};

type Slot = { time: string; startAt: string; staffMemberIds: string[] };

const STEPS = ['Prestation', 'Professionnel', 'Date et heure', 'Confirmation'] as const;

const CLOSED_MESSAGES: Record<string, string> = {
  PAST: 'Cette date est passée.',
  TOO_FAR: 'Cet établissement n’ouvre pas encore les réservations si loin.',
  TOO_SOON: 'Plus de créneau disponible aujourd’hui.',
  CLOSED: 'Fermé ce jour-là.',
  NO_STAFF: 'Aucun professionnel ne propose cette prestation ce jour-là.',
};

export function BookingFlow({
  business,
  services,
  staff,
  today,
  preselectedServiceId,
  preselectedStaffId,
}: {
  business: Business;
  services: Service[];
  staff: Staff[];
  today: string;
  preselectedServiceId: string | null;
  preselectedStaffId: string | null;
}) {
  const router = useRouter();
  const [submitting, startSubmit] = useTransition();

  const [serviceId, setServiceId] = useState<string | null>(
    services.some((s) => s.id === preselectedServiceId) ? preselectedServiceId : null,
  );
  const [staffId, setStaffId] = useState<string | null>(preselectedStaffId);
  const [day, setDay] = useState<string>(today);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [note, setNote] = useState('');

  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [closedReason, setClosedReason] = useState<string | undefined>();
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;

  /** Only professionals who perform the chosen service. */
  const eligibleStaff = useMemo(
    () => (service ? staff.filter((m) => m.isBookable && m.serviceIds.includes(service.id)) : []),
    [service, staff],
  );

  // A preselected professional who cannot perform the chosen service is dropped
  // rather than silently producing an empty calendar.
  useEffect(() => {
    if (staffId && service && !eligibleStaff.some((m) => m.id === staffId)) {
      setStaffId(null);
    }
  }, [staffId, service, eligibleStaff]);

  const step = !serviceId ? 0 : staffId === null && eligibleStaff.length > 1 ? 1 : !slot ? 2 : 3;

  const loadSlots = useCallback(
    async (targetDay: string) => {
      if (!serviceId) return;
      setLoadingSlots(true);
      setError(null);
      const result = await fetchAvailabilityAction({
        businessId: business.id,
        serviceId,
        staffMemberId: staffId,
        day: targetDay,
      });
      setLoadingSlots(false);
      if (!result.ok) {
        setError(result.message);
        setSlots([]);
        return;
      }
      setSlots(result.slots);
      setClosedReason(result.closedReason);
    },
    [business.id, serviceId, staffId],
  );

  // Availability is always re-read from the server when the inputs change —
  // the browser never derives a slot on its own.
  useEffect(() => {
    if (serviceId) void loadSlots(day);
  }, [serviceId, staffId, day, loadSlots]);

  // The next 21 days, which the date strip scrolls through.
  const days = useMemo(
    () =>
      Array.from({ length: Math.min(21, business.maxAdvanceDays) }, (_, i) => {
        const key = addDays(today, i);
        const date = new Date(`${key}T12:00:00Z`);
        return {
          key,
          weekday: new Intl.DateTimeFormat('fr-TN', { weekday: 'short' }).format(date),
          dayNum: new Intl.DateTimeFormat('fr-TN', { day: 'numeric' }).format(date),
          month: new Intl.DateTimeFormat('fr-TN', { month: 'short' }).format(date),
        };
      }),
    [today, business.maxAdvanceDays],
  );

  function submit() {
    if (!service || !slot) return;
    const chosenStaff = staffId ?? slot.staffMemberIds[0];
    if (!chosenStaff) return;

    const formData = new FormData();
    formData.set('businessId', business.id);
    formData.set('serviceId', service.id);
    formData.set('staffMemberId', chosenStaff);
    formData.set('startAt', slot.startAt);
    if (note) formData.set('customerNote', note);

    startSubmit(async () => {
      const result = await createReservationAction({ status: 'idle' }, formData);
      if (result.status === 'success' && result.data) {
        router.push(`/reservations/${result.data.reference}?new=1`);
        return;
      }
      if (result.status === 'error') {
        setError(result.message);
        setSlot(null);
        // The slot was taken while the customer was deciding — refresh so they
        // are choosing from what is actually free now.
        void loadSlots(day);
      }
    });
  }

  const serviceGroups = useMemo(
    () =>
      services.reduce<Record<string, Service[]>>((acc, s) => {
        const key = s.categoryName ?? 'Prestations';
        (acc[key] ??= []).push(s);
        return acc;
      }, {}),
    [services],
  );

  return (
    <div className="z-booking">
      <div className="z-container">
        <header className="z-booking__head">
          <Link href={`/business/${business.slug}`} className="z-booking__back">
            ← {business.name}
          </Link>
          <ol className="z-steps" aria-label="Étapes de réservation">
            {STEPS.map((label, i) => (
              <li
                key={label}
                className={`z-steps__item ${i === step ? 'is-current' : ''} ${i < step ? 'is-done' : ''}`}
                aria-current={i === step ? 'step' : undefined}
              >
                <span className="z-steps__dot">{i < step ? '✓' : i + 1}</span>
                <span className="z-steps__label">{label}</span>
              </li>
            ))}
          </ol>
        </header>

        <div className="z-booking__grid">
          <div className="z-booking__main">
            {error ? <Alert tone="error">{error}</Alert> : null}

            {/* ── 1. Service ─────────────────────────────────────────── */}
            <section className="z-booking__section">
              <h2 className="z-booking__h2">1. Choisissez une prestation</h2>
              {Object.entries(serviceGroups).map(([group, items]) => (
                <div key={group} className="z-svc-group">
                  <p className="z-eyebrow">{group}</p>
                  <div className="z-choices">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`z-choice ${serviceId === item.id ? 'is-selected' : ''}`}
                        aria-pressed={serviceId === item.id}
                        onClick={() => {
                          setServiceId(item.id);
                          setSlot(null);
                        }}
                      >
                        <span className="z-choice__body">
                          <span className="z-choice__title">{item.name}</span>
                          <span className="z-choice__meta">
                            {formatDuration(item.durationMinutes)}
                          </span>
                        </span>
                        <span className="z-choice__price">
                          {formatPrice(item.price, 'fr', business.currency)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            {/* ── 2. Professional ────────────────────────────────────── */}
            {service ? (
              <section className="z-booking__section">
                <h2 className="z-booking__h2">2. Choisissez un professionnel</h2>
                {eligibleStaff.length === 0 ? (
                  <Alert tone="warning">
                    Aucun professionnel ne propose cette prestation pour le moment.
                  </Alert>
                ) : (
                  <div className="z-choices z-choices--people">
                    <button
                      type="button"
                      className={`z-person ${staffId === null ? 'is-selected' : ''}`}
                      aria-pressed={staffId === null}
                      onClick={() => {
                        setStaffId(null);
                        setSlot(null);
                      }}
                    >
                      <span className="z-person__avatar" aria-hidden="true">
                        ★
                      </span>
                      <span className="z-person__name">Peu importe</span>
                      <span className="z-person__title">Le premier disponible</span>
                    </button>

                    {eligibleStaff.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        className={`z-person ${staffId === member.id ? 'is-selected' : ''}`}
                        aria-pressed={staffId === member.id}
                        onClick={() => {
                          setStaffId(member.id);
                          setSlot(null);
                        }}
                      >
                        <span className="z-person__avatar">
                          {member.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={member.avatarUrl} alt="" />
                          ) : (
                            member.displayName
                              .split(' ')
                              .map((p) => p[0])
                              .join('')
                              .slice(0, 2)
                          )}
                        </span>
                        <span className="z-person__name">{member.displayName}</span>
                        {member.title ? (
                          <span className="z-person__title">{member.title}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {/* ── 3. Date and time ───────────────────────────────────── */}
            {service && eligibleStaff.length > 0 ? (
              <section className="z-booking__section">
                <h2 className="z-booking__h2">3. Choisissez un créneau</h2>

                <div className="z-scroll-x z-daystrip">
                  {days.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      className={`z-day ${day === d.key ? 'is-selected' : ''}`}
                      aria-pressed={day === d.key}
                      onClick={() => {
                        setDay(d.key);
                        setSlot(null);
                      }}
                    >
                      <span className="z-day__weekday">{d.weekday}</span>
                      <span className="z-day__num">{d.dayNum}</span>
                      <span className="z-day__month">{d.month}</span>
                    </button>
                  ))}
                </div>

                <div className="z-slots" aria-live="polite" aria-busy={loadingSlots}>
                  {loadingSlots ? (
                    <div className="z-slots__grid">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <Skeleton key={i} height={46} radius={10} />
                      ))}
                    </div>
                  ) : slots && slots.length > 0 ? (
                    <div className="z-slots__grid">
                      {slots.map((s) => (
                        <button
                          key={s.startAt}
                          type="button"
                          className={`z-slot ${slot?.startAt === s.startAt ? 'is-selected' : ''}`}
                          aria-pressed={slot?.startAt === s.startAt}
                          onClick={() => setSlot(s)}
                        >
                          {s.time}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="z-slots__empty">
                      <p>
                        <strong>
                          {CLOSED_MESSAGES[closedReason ?? 'CLOSED'] ??
                            'Aucun créneau disponible ce jour.'}
                        </strong>
                      </p>
                      <p>Essayez une autre date ou un autre professionnel.</p>
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {/* ── 4. Note ────────────────────────────────────────────── */}
            {slot ? (
              <section className="z-booking__section">
                <h2 className="z-booking__h2">4. Un message pour l’établissement ?</h2>
                <textarea
                  className="z-textarea"
                  value={note}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optionnel — une précision, une allergie, une demande particulière…"
                  aria-label="Message pour l’établissement"
                />
              </section>
            ) : null}
          </div>

          {/* ── Summary ──────────────────────────────────────────────── */}
          <aside className="z-booking__aside">
            <div className="z-panel z-booking__summary">
              <h2 className="z-profile__h3">Récapitulatif</h2>

              <dl className="z-summary">
                <div>
                  <dt>Établissement</dt>
                  <dd>{business.name}</dd>
                </div>
                <div>
                  <dt>Prestation</dt>
                  <dd>{service ? service.name : <span className="z-muted">À choisir</span>}</dd>
                </div>
                <div>
                  <dt>Professionnel</dt>
                  <dd>
                    {staffId
                      ? (eligibleStaff.find((m) => m.id === staffId)?.displayName ?? '—')
                      : service
                        ? 'Peu importe'
                        : <span className="z-muted">À choisir</span>}
                  </dd>
                </div>
                <div>
                  <dt>Date et heure</dt>
                  <dd>
                    {slot ? (
                      new Intl.DateTimeFormat('fr-TN', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                        timeZone: business.timezone,
                      }).format(new Date(slot.startAt))
                    ) : (
                      <span className="z-muted">À choisir</span>
                    )}
                  </dd>
                </div>
                {service ? (
                  <div>
                    <dt>Durée</dt>
                    <dd>{formatDuration(service.durationMinutes)}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="z-summary__total">
                <span>Total</span>
                <strong>
                  {service ? formatPrice(service.price, 'fr', business.currency) : '—'}
                </strong>
              </div>

              {!business.autoConfirm ? (
                <Badge tone="warning">Confirmation par l’établissement</Badge>
              ) : null}

              <Button
                size="lg"
                block
                disabled={!service || !slot}
                loading={submitting}
                onClick={submit}
              >
                Confirmer la réservation
              </Button>

              <p className="z-policy z-policy--muted">
                Annulation gratuite jusqu’à {business.cancellationWindowHours} h avant le
                rendez-vous.
                {business.cancellationPolicy ? ` ${business.cancellationPolicy}` : ''}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
