'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Badge, Card } from '@/components/ui/Primitives';
import { idle, fieldError } from '@/lib/formState';
import { formatDuration, formatPrice } from '@/i18n/format';
import { interpolate } from '@/i18n/interpolate';
import type { Messages } from '@/i18n';
import { localePath, type Locale } from '@/i18n/config';
import {
  createWalkInAction,
  proAvailabilityAction,
  searchBusinessCustomersAction,
} from '@/server/actions/walkIn';

type Service = {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  staffIds: string[];
};
type Staff = { id: string; displayName: string };
type Slot = { time: string; startAt: string; staffMemberIds: string[] };
type Customer = { id: string; name: string; phone: string | null };

type Dict = {
  walkIn: Messages['dash']['walkIn'];
  channel: Messages['labels']['channel'];
  common: Messages['common'];
};

function todayIn(timezone: string): string {
  // The business's own day, not the browser's — a salon in Tunis should see
  // its own date even if the staff tablet is set to another zone.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function Submit({ disabled, d }: { disabled: boolean; d: Dict['walkIn'] }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" disabled={disabled || pending}>
      {pending ? d.submitting : d.submit}
    </Button>
  );
}

/**
 * Taking a booking at the counter or over the phone.
 *
 * This is the same booking engine the public site uses: the slots come from
 * the server, and saving goes through `createReservation`, so the exclusion
 * constraint protects these appointments exactly like online ones. The
 * difference is who the appointment belongs to — often someone who has no
 * account and never will.
 */
export function WalkInForm({
  m,
  locale,
  businessId,
  services,
  staff,
  currency,
  timezone,
}: {
  m: Dict;
  locale: Locale;
  businessId: string;
  services: Service[];
  staff: Staff[];
  currency: string;
  timezone: string;
}) {
  const router = useRouter();
  const [state, action] = useActionState(createWalkInAction, idle);
  const d = m.walkIn;

  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [staffId, setStaffId] = useState('');
  const [day, setDay] = useState(() => todayIn(timezone));
  const [startAt, setStartAt] = useState('');

  const [slots, setSlots] = useState<Slot[]>([]);
  const [closedReason, setClosedReason] = useState<string | undefined>();
  const [loadingSlots, startLoading] = useTransition();

  const [channel, setChannel] = useState<'WALK_IN' | 'PHONE'>('WALK_IN');
  const [mode, setMode] = useState<'guest' | 'existing'>('guest');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Customer[]>([]);

  const service = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId],
  );

  // Only professionals who actually perform the chosen service.
  const eligibleStaff = useMemo(
    () => (service ? staff.filter((member) => service.staffIds.includes(member.id)) : staff),
    [staff, service],
  );

  // If the selected professional does not perform the newly chosen service,
  // fall back to "anyone" rather than silently keeping an invalid pair.
  useEffect(() => {
    if (staffId && !eligibleStaff.some((member) => member.id === staffId)) setStaffId('');
  }, [eligibleStaff, staffId]);

  // Load availability whenever the query changes. A sequence number drops
  // responses that arrive out of order, so a slow earlier request cannot
  // overwrite the slots for the date now on screen.
  const seq = useRef(0);
  useEffect(() => {
    if (!serviceId || !day) {
      setSlots([]);
      return;
    }
    const mine = ++seq.current;
    setStartAt('');
    startLoading(async () => {
      const res = await proAvailabilityAction({
        businessId,
        serviceId,
        staffMemberId: staffId || null,
        day,
      });
      if (mine !== seq.current) return;
      if (res.ok) {
        setSlots(res.slots);
        setClosedReason(res.slots.length === 0 ? (res.closedReason ?? 'FULLY_BOOKED') : undefined);
      } else {
        setSlots([]);
        setClosedReason(undefined);
      }
    });
  }, [businessId, serviceId, staffId, day]);

  // Debounced customer lookup, scoped server-side to this business.
  useEffect(() => {
    if (mode !== 'existing' || query.trim().length < 2) {
      setMatches([]);
      return;
    }
    const t = setTimeout(async () => {
      setMatches(await searchBusinessCustomersAction({ businessId, query }));
    }, 250);
    return () => clearTimeout(t);
  }, [businessId, query, mode]);

  useEffect(() => {
    if (state.status === 'success' && state.data) {
      router.push(
        localePath(locale, `/pro/dashboard/reservations?created=${state.data.reference}`),
      );
    }
  }, [state, router, locale]);

  const chosen = slots.find((s) => s.startAt === startAt);
  // The engine returns every professional free at that instant; pin one so the
  // server books the person the staff actually intends.
  const resolvedStaffId = staffId || chosen?.staffMemberIds[0] || '';

  const ready = Boolean(serviceId && resolvedStaffId && startAt);

  if (services.length === 0 || staff.length === 0) {
    return (
      <Card>
        <h2 className="z-h3">{d.missingTitle}</h2>
        <p className="z-body">{d.missingBody}</p>
        <div className="z-row z-row--gap" style={{ flexWrap: 'wrap' }}>
          <Link
            className="z-btn z-btn--secondary"
            href={localePath(locale, '/pro/dashboard/services')}
          >
            {d.manageServices}
          </Link>
          <Link className="z-btn z-btn--ghost" href={localePath(locale, '/pro/dashboard/team')}>
            {d.manageTeam}
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <form action={action} className="z-stack z-stack--lg">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="startAt" value={startAt} />
      <input type="hidden" name="staffMemberId" value={resolvedStaffId} />
      <input type="hidden" name="channel" value={channel} />
      {mode === 'existing' && customer ? (
        <input type="hidden" name="customerId" value={customer.id} />
      ) : null}

      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

      <Card>
        <h2 className="z-h3">{d.step1}</h2>
        <div className="z-choices" role="radiogroup" aria-label={d.channelLabel}>
          {(
            [
              { value: 'WALK_IN', label: d.walkInTitle, hint: d.walkInHint },
              { value: 'PHONE', label: d.phoneTitle, hint: d.phoneHint },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={channel === opt.value}
              className={`z-choice ${channel === opt.value ? 'is-selected' : ''}`}
              onClick={() => setChannel(opt.value)}
            >
              <span className="z-choice__body">
                <span className="z-choice__title">{opt.label}</span>
                <span className="z-choice__meta">{opt.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="z-h3">{d.step2}</h2>
        <div className="z-choices" role="radiogroup" aria-label={d.customerTypeLabel}>
          {(
            [
              { value: 'guest', label: d.guestTitle, hint: d.guestHint },
              { value: 'existing', label: d.existingTitle, hint: d.existingHint },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={mode === opt.value}
              className={`z-choice ${mode === opt.value ? 'is-selected' : ''}`}
              onClick={() => {
                setMode(opt.value);
                setCustomer(null);
                setQuery('');
              }}
            >
              <span className="z-choice__body">
                <span className="z-choice__title">{opt.label}</span>
                <span className="z-choice__meta">{opt.hint}</span>
              </span>
            </button>
          ))}
        </div>

        {mode === 'guest' ? (
          <div className="z-grid z-grid--2 z-mt-md">
            <Input
              label={d.guestName}
              name="guestName"
              required
              autoComplete="off"
              placeholder={d.guestNamePlaceholder}
              error={fieldError(state, 'guestName')}
            />
            <Input
              label={d.guestPhone}
              name="guestPhone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              optional
              placeholder={d.guestPhonePlaceholder}
              hint={d.guestPhoneHint}
              error={fieldError(state, 'guestPhone')}
            />
          </div>
        ) : (
          <div className="z-mt-md">
            {customer ? (
              <div className="z-selected-customer">
                <div>
                  <strong>{customer.name}</strong>
                  {customer.phone ? (
                    <span className="z-muted">
                      {' · '}
                      <bdi dir="ltr">{customer.phone}</bdi>
                    </span>
                  ) : null}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCustomer(null)}>
                  {d.change}
                </Button>
              </div>
            ) : (
              <>
                <Input
                  label={d.search}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                  placeholder={d.searchPlaceholder}
                  hint={d.searchHint}
                  error={fieldError(state, 'guestName')}
                />
                {matches.length > 0 ? (
                  <ul className="z-suggest">
                    {matches.map((match) => (
                      <li key={match.id}>
                        <button type="button" className="z-suggest__item" onClick={() => setCustomer(match)}>
                          <span>{match.name}</span>
                          {match.phone ? (
                            <span className="z-muted" dir="ltr">
                              {match.phone}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : query.trim().length >= 2 ? (
                  <p className="z-help z-mt-sm">
                    {interpolate(d.noMatch, { guest: d.guestTitle })}
                  </p>
                ) : null}
              </>
            )}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="z-h3">{d.step3}</h2>
        <div className="z-grid z-grid--3">
          <Select
            label={d.service}
            name="serviceId"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            error={fieldError(state, 'serviceId')}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {interpolate(d.serviceOption, {
                  name: s.name,
                  price: formatPrice(s.price, locale, currency),
                  duration: formatDuration(s.durationMinutes, locale),
                })}
              </option>
            ))}
          </Select>
          <Select
            label={d.staff}
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            hint={staffId ? undefined : d.staffHint}
          >
            <option value="">{d.anyone}</option>
            {eligibleStaff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </Select>
          <Input
            label={d.date}
            type="date"
            value={day}
            min={todayIn(timezone)}
            onChange={(e) => setDay(e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <h2 className="z-h3">{d.step4}</h2>
        {loadingSlots ? (
          <p className="z-help">{d.loadingSlots}</p>
        ) : slots.length === 0 ? (
          <p className="z-help">
            {(closedReason && (d.closed as Record<string, string>)[closedReason]) || d.noSlots}
          </p>
        ) : (
          <>
            <div className="z-slots__grid" role="radiogroup" aria-label={d.slotsLabel}>
              {slots.map((s) => (
                <button
                  key={s.startAt}
                  type="button"
                  role="radio"
                  aria-checked={startAt === s.startAt}
                  className={`z-slot ${startAt === s.startAt ? 'is-selected' : ''}`}
                  onClick={() => setStartAt(s.startAt)}
                >
                  <bdi dir="ltr">{s.time}</bdi>
                </button>
              ))}
            </div>
            <p className="z-help z-mt-sm">{d.slotsHelp}</p>
          </>
        )}
      </Card>

      <Card>
        <h2 className="z-h3">{d.step5}</h2>
        <Textarea
          label={d.noteLabel}
          name="internalNote"
          optional
          rows={3}
          maxLength={500}
          placeholder={d.notePlaceholder}
          error={fieldError(state, 'internalNote')}
        />
      </Card>

      <div className="z-sticky-actions">
        <div className="z-sticky-actions__summary">
          {service ? (
            <>
              <Badge tone="accent">{m.channel[channel]}</Badge>
              <span>
                {service.name} · {formatPrice(service.price, locale, currency)}
                {chosen ? (
                  <>
                    {' · '}
                    <bdi dir="ltr">{chosen.time}</bdi>
                  </>
                ) : null}
              </span>
            </>
          ) : null}
        </div>
        <div className="z-row z-row--gap">
          <Link
            className="z-btn z-btn--ghost"
            href={localePath(locale, '/pro/dashboard/reservations')}
          >
            {m.common.cancel}
          </Link>
          <Submit disabled={!ready} d={d} />
        </div>
      </div>
      {!ready ? (
        <p className="z-help">{d.notReady}</p>
      ) : null}
    </form>
  );
}
