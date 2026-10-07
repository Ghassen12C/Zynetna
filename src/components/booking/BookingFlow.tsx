'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Primitives';
import { Skeleton } from '@/components/ui/Primitives';
import {
  createReservationAction,
  fetchAvailabilityAction,
  rescheduleReservationAction,
} from '@/server/actions/booking';
import { addDays } from '@/domain/scheduling/time';
import { formatDuration, formatPrice } from '@/i18n/format';
import { DEFAULT_LOCALE, interpolate, LOCALE_META, type Locale, type Messages } from '@/i18n';

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

type Rescheduling = {
  reservationId: string;
  reference: string;
  currentStartAt: string;
  serviceId: string;
  staffMemberId: string;
} | null;

export function BookingFlow({
  business,
  services,
  staff,
  today,
  preselectedServiceId,
  preselectedStaffId,
  rescheduling = null,
  m,
  locale,
}: {
  business: Business;
  services: Service[];
  staff: Staff[];
  today: string;
  preselectedServiceId: string | null;
  preselectedStaffId: string | null;
  rescheduling?: Rescheduling;
  /** Only the slices this flow renders, not the whole dictionary. */
  m: { booking: Messages['booking']; business: Messages['business']; common: Messages['common'] };
  locale: Locale;
}) {
  const router = useRouter();
  const [submitting, startSubmit] = useTransition();
  const intl = LOCALE_META[locale].intl;
  // Confirming must not drop the visitor out of their language.
  const localePrefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;

  const steps = [
    m.booking.stepService,
    m.booking.stepStaff,
    m.booking.stepTime,
    m.booking.stepConfirm,
  ];

  const closedMessages: Record<string, string> = {
    PAST: m.booking.closedPast,
    TOO_FAR: m.booking.closedTooFar,
    TOO_SOON: m.booking.closedTooSoon,
    CLOSED: m.booking.closedClosed,
    NO_STAFF: m.booking.closedNoStaff,
  };

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
  const enforcedPolicy = interpolate(m.booking.freeCancellation, {
    hours: business.cancellationWindowHours,
  });

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
          weekday: new Intl.DateTimeFormat(intl, { weekday: 'short' }).format(date),
          dayNum: new Intl.DateTimeFormat(intl, { day: 'numeric' }).format(date),
          month: new Intl.DateTimeFormat(intl, { month: 'short' }).format(date),
        };
      }),
    [today, business.maxAdvanceDays, intl],
  );

  function submit() {
    if (!service || !slot) return;
    const chosenStaff = staffId ?? slot.staffMemberIds[0];
    if (!chosenStaff) return;

    const formData = new FormData();

    if (rescheduling) {
      // Moving an appointment goes through the reschedule action, which books
      // the replacement first and only then retires the original — so a slot
      // lost to someone else leaves the customer's existing appointment intact.
      formData.set('reservationId', rescheduling.reservationId);
      formData.set('startAt', slot.startAt);
      formData.set('staffMemberId', chosenStaff);
    } else {
      formData.set('businessId', business.id);
      formData.set('serviceId', service.id);
      formData.set('staffMemberId', chosenStaff);
      formData.set('startAt', slot.startAt);
      if (note) formData.set('customerNote', note);
    }

    startSubmit(async () => {
      const result = rescheduling
        ? await rescheduleReservationAction({ status: 'idle' }, formData)
        : await createReservationAction({ status: 'idle' }, formData);

      if (result.status === 'success' && result.data) {
        router.push(`${localePrefix}/reservations/${result.data.reference}?new=1`);
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
        const key = s.categoryName ?? m.business.services;
        (acc[key] ??= []).push(s);
        return acc;
      }, {}),
    [services, m.business.services],
  );

  return (
    <div className="z-booking">
      <div className="z-container">
        <header className="z-booking__head">
          <Link href={`${localePrefix}/business/${business.slug}`} className="z-booking__back">
            ← {business.name}
          </Link>
          <ol className="z-steps" aria-label={m.booking.stepsLabel}>
            {steps.map((label, i) => (
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

            {rescheduling ? (
              <Alert tone="info">
                {interpolate(m.booking.reschedulingNotice, {
                  reference: rescheduling.reference,
                  when: new Intl.DateTimeFormat(intl, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: business.timezone,
                  }).format(new Date(rescheduling.currentStartAt)),
                })}
              </Alert>
            ) : null}

            {/* ── 1. Service ─────────────────────────────────────────── */}
            <section className="z-booking__section">
              <h2 className="z-booking__h2">
                {rescheduling ? m.booking.stepService : m.booking.step1Heading}
              </h2>
              {Object.entries(serviceGroups)
                .map(([group, items]): [string, Service[]] => [
                  group,
                  rescheduling ? items.filter((i) => i.id === rescheduling.serviceId) : items,
                ])
                .filter(([, items]) => items.length > 0)
                .map(([group, items]) => (
                <div key={group} className="z-svc-group">
                  <p className="z-eyebrow">{group}</p>
                  <div className="z-choices">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`z-choice ${serviceId === item.id ? 'is-selected' : ''}`}
                        aria-pressed={serviceId === item.id}
                        // Changing the prestation would be a different booking,
                        // not a move, so it is fixed while rescheduling.
                        disabled={Boolean(rescheduling)}
                        onClick={() => {
                          setServiceId(item.id);
                          setSlot(null);
                        }}
                      >
                        <span className="z-choice__body">
                          <span className="z-choice__title">{item.name}</span>
                          <span className="z-choice__meta">
                            {formatDuration(item.durationMinutes, locale)}
                          </span>
                        </span>
                        <span className="z-choice__price">
                          {formatPrice(item.price, locale, business.currency)}
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
                <h2 className="z-booking__h2">{m.booking.step2Heading}</h2>
                {eligibleStaff.length === 0 ? (
                  <Alert tone="warning">{m.booking.noStaffForService}</Alert>
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
                      <span className="z-person__name">{m.booking.anyStaff}</span>
                      <span className="z-person__title">{m.booking.firstAvailable}</span>
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
                <h2 className="z-booking__h2">{m.booking.step3Heading}</h2>

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
                    // Keyed on the day so the cascade replays for each date:
                    // it shows that these are new times, not the old ones.
                    <div className="z-slots__grid" key={day}>
                      {slots.map((s, i) => (
                        <button
                          key={s.startAt}
                          type="button"
                          style={{ ['--i' as string]: Math.min(i, 24) }}
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
                          {closedMessages[closedReason ?? 'CLOSED'] ??
                            m.booking.closedFallback}
                        </strong>
                      </p>
                      <p>{m.booking.noSlotsBody}</p>
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {/* ── 4. Note ────────────────────────────────────────────── */}
            {slot ? (
              <section className="z-booking__section">
                <h2 className="z-booking__h2">{m.booking.step4Heading}</h2>
                <textarea
                  className="z-textarea"
                  value={note}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={m.booking.notePlaceholderLong}
                  aria-label={m.booking.noteAriaLabel}
                />
              </section>
            ) : null}
          </div>

          {/* ── Summary ──────────────────────────────────────────────── */}
          <aside className="z-booking__aside">
            <div className="z-panel z-booking__summary">
              <h2 className="z-profile__h3">{m.booking.summary}</h2>

              <dl className="z-summary">
                <div>
                  <dt>{m.booking.businessLabel}</dt>
                  <dd>{business.name}</dd>
                </div>
                <div>
                  <dt>{m.booking.stepService}</dt>
                  <dd key={service?.id ?? 'none'} className="z-tick">
                    {service ? (
                      service.name
                    ) : (
                      <span className="z-muted">{m.booking.toChoose}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{m.booking.stepStaff}</dt>
                  <dd key={staffId ?? (service ? 'any' : 'none')} className="z-tick">
                    {staffId
                      ? (eligibleStaff.find((m) => m.id === staffId)?.displayName ?? '—')
                      : service
                        ? m.booking.anyStaff
                        : <span className="z-muted">{m.booking.toChoose}</span>}
                  </dd>
                </div>
                <div>
                  <dt>{m.booking.stepTime}</dt>
                  <dd key={slot?.startAt ?? 'none'} className="z-tick">
                    {slot ? (
                      new Intl.DateTimeFormat(intl, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                        timeZone: business.timezone,
                      }).format(new Date(slot.startAt))
                    ) : (
                      <span className="z-muted">{m.booking.toChoose}</span>
                    )}
                  </dd>
                </div>
                {service ? (
                  <div>
                    <dt>{m.booking.duration}</dt>
                    <dd>{formatDuration(service.durationMinutes, locale)}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="z-summary__total">
                <span>{m.booking.total}</span>
                <strong key={service?.id ?? 'none'} className="z-tick">
                  {service ? formatPrice(service.price, locale, business.currency) : '—'}
                </strong>
              </div>

              {!business.autoConfirm ? (
                <Badge tone="warning">{m.booking.needsConfirmation}</Badge>
              ) : null}

              <Button
                size="lg"
                block
                disabled={!service || !slot}
                loading={submitting}
                onClick={submit}
              >
                {rescheduling ? m.booking.moveAppointment : m.booking.confirm}
              </Button>

              {/* The enforced rule always shows in the visitor's language: it
                  is what the system will actually apply. The business's own
                  wording sits beneath it, and only replaces it when it
                  already opens with that exact rule. */}
              {business.cancellationPolicy?.includes(enforcedPolicy) ? null : (
                <p className="z-policy z-policy--muted">{enforcedPolicy}</p>
              )}
              {business.cancellationPolicy ? (
                <p className="z-policy z-policy--quote">{business.cancellationPolicy}</p>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
