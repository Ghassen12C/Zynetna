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
import { formatPrice } from '@/i18n/format';
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

const CLOSED_REASON: Record<string, string> = {
  CLOSED: 'Fermé ce jour-là.',
  PAST: 'Cette date est passée.',
  TOO_FAR: 'Cette date dépasse votre horizon de réservation.',
  NO_STAFF: 'Aucun professionnel disponible ce jour-là.',
  FULLY_BOOKED: 'Journée complète — plus aucun créneau libre.',
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

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" disabled={disabled || pending}>
      {pending ? 'Enregistrement…' : 'Enregistrer le rendez-vous'}
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
  businessId,
  services,
  staff,
  currency,
  timezone,
}: {
  businessId: string;
  services: Service[];
  staff: Staff[];
  currency: string;
  timezone: string;
}) {
  const router = useRouter();
  const [state, action] = useActionState(createWalkInAction, idle);

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
    () => (service ? staff.filter((m) => service.staffIds.includes(m.id)) : staff),
    [staff, service],
  );

  // If the selected professional does not perform the newly chosen service,
  // fall back to "anyone" rather than silently keeping an invalid pair.
  useEffect(() => {
    if (staffId && !eligibleStaff.some((m) => m.id === staffId)) setStaffId('');
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
      router.push(`/pro/dashboard/reservations?created=${state.data.reference}`);
    }
  }, [state, router]);

  const chosen = slots.find((s) => s.startAt === startAt);
  // The engine returns every professional free at that instant; pin one so the
  // server books the person the staff actually intends.
  const resolvedStaffId = staffId || chosen?.staffMemberIds[0] || '';

  const ready = Boolean(serviceId && resolvedStaffId && startAt);

  if (services.length === 0 || staff.length === 0) {
    return (
      <Card>
        <h2 className="z-h3">Il manque une étape</h2>
        <p className="z-body">
          Pour enregistrer un rendez-vous, vous avez besoin d’au moins un service et un
          professionnel.
        </p>
        <div className="z-row z-row--gap">
          <Link className="z-btn z-btn--secondary" href="/pro/dashboard/services">
            Gérer les services
          </Link>
          <Link className="z-btn z-btn--ghost" href="/pro/dashboard/team">
            Gérer l’équipe
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
        <h2 className="z-h3">1 · Comment la réservation arrive-t-elle ?</h2>
        <div className="z-choices" role="radiogroup" aria-label="Canal">
          {(
            [
              { value: 'WALK_IN', label: 'Sur place', hint: 'La personne est au salon' },
              { value: 'PHONE', label: 'Par téléphone', hint: 'Appel reçu' },
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
        <h2 className="z-h3">2 · Pour qui ?</h2>
        <div className="z-choices" role="radiogroup" aria-label="Type de client">
          {(
            [
              { value: 'guest', label: 'Nouvelle personne', hint: 'Pas de compte Zynetna' },
              { value: 'existing', label: 'Client connu', hint: 'Déjà venu chez vous' },
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
              label="Nom de la personne"
              name="guestName"
              required
              autoComplete="off"
              placeholder="Ex. Leïla Ben Salah"
              error={fieldError(state, 'guestName')}
            />
            <Input
              label="Téléphone"
              name="guestPhone"
              type="tel"
              inputMode="tel"
              optional
              placeholder="+216 …"
              hint="Pour la retrouver et la rappeler."
              error={fieldError(state, 'guestPhone')}
            />
          </div>
        ) : (
          <div className="z-mt-md">
            {customer ? (
              <div className="z-selected-customer">
                <div>
                  <strong>{customer.name}</strong>
                  {customer.phone ? <span className="z-muted"> · {customer.phone}</span> : null}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCustomer(null)}>
                  Changer
                </Button>
              </div>
            ) : (
              <>
                <Input
                  label="Rechercher un client"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                  placeholder="Nom ou téléphone"
                  hint="Parmi les clients déjà venus chez vous."
                  error={fieldError(state, 'guestName')}
                />
                {matches.length > 0 ? (
                  <ul className="z-suggest">
                    {matches.map((m) => (
                      <li key={m.id}>
                        <button type="button" className="z-suggest__item" onClick={() => setCustomer(m)}>
                          <span>{m.name}</span>
                          {m.phone ? <span className="z-muted">{m.phone}</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : query.trim().length >= 2 ? (
                  <p className="z-help z-mt-sm">
                    Aucun client trouvé. Utilisez « Nouvelle personne ».
                  </p>
                ) : null}
              </>
            )}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="z-h3">3 · Quelle prestation ?</h2>
        <div className="z-grid z-grid--3">
          <Select
            label="Service"
            name="serviceId"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            error={fieldError(state, 'serviceId')}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {formatPrice(s.price, 'fr', currency)} · {s.durationMinutes} min
              </option>
            ))}
          </Select>
          <Select
            label="Professionnel"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            hint={staffId ? undefined : 'Le premier disponible sera assigné.'}
          >
            <option value="">Peu importe</option>
            {eligibleStaff.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </Select>
          <Input
            label="Date"
            type="date"
            value={day}
            min={todayIn(timezone)}
            onChange={(e) => setDay(e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <h2 className="z-h3">4 · Quel créneau ?</h2>
        {loadingSlots ? (
          <p className="z-help">Chargement des disponibilités…</p>
        ) : slots.length === 0 ? (
          <p className="z-help">{closedReason ? CLOSED_REASON[closedReason] ?? 'Aucun créneau disponible.' : 'Aucun créneau disponible.'}</p>
        ) : (
          <>
            <div className="z-slots__grid" role="radiogroup" aria-label="Créneaux">
              {slots.map((s) => (
                <button
                  key={s.startAt}
                  type="button"
                  role="radio"
                  aria-checked={startAt === s.startAt}
                  className={`z-slot ${startAt === s.startAt ? 'is-selected' : ''}`}
                  onClick={() => setStartAt(s.startAt)}
                >
                  {s.time}
                </button>
              ))}
            </div>
            <p className="z-help z-mt-sm">
              Ces créneaux tiennent compte des horaires, des congés et des rendez-vous déjà
              pris. Les minutes de préavis ne s’appliquent pas au comptoir.
            </p>
          </>
        )}
      </Card>

      <Card>
        <h2 className="z-h3">5 · Note interne</h2>
        <Textarea
          label="Visible par votre équipe uniquement"
          name="internalNote"
          optional
          rows={3}
          maxLength={500}
          placeholder="Ex. a demandé Nour, allergique à l’ammoniaque…"
          error={fieldError(state, 'internalNote')}
        />
      </Card>

      <div className="z-sticky-actions">
        <div className="z-sticky-actions__summary">
          {service ? (
            <>
              <Badge tone="accent">{channel === 'WALK_IN' ? 'Sur place' : 'Téléphone'}</Badge>
              <span>
                {service.name} · {formatPrice(service.price, 'fr', currency)}
                {chosen ? ` · ${chosen.time}` : ''}
              </span>
            </>
          ) : null}
        </div>
        <div className="z-row z-row--gap">
          <Link className="z-btn z-btn--ghost" href="/pro/dashboard/reservations">
            Annuler
          </Link>
          <Submit disabled={!ready} />
        </div>
      </div>
      {!ready ? (
        <p className="z-help">Choisissez un service, une date et un créneau pour enregistrer.</p>
      ) : null}
    </form>
  );
}
