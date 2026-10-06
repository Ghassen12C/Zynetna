'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Badge, Panel } from '@/components/ui/Primitives';
import {
  addExceptionAction,
  deleteExceptionAction,
  saveHoursAction,
} from '@/server/actions/business';
import { idle } from '@/lib/formState';
import { minutesToHHMM } from '@/domain/scheduling/time';

const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const KIND_LABEL: Record<string, string> = {
  CLOSED: 'Fermeture',
  HOLIDAY: 'Jour férié',
  VACATION: 'Congés',
  BREAK: 'Pause',
  SPECIAL_HOURS: 'Horaires exceptionnels',
};

type Period = { startMin: number; endMin: number };

function DaySubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      Enregistrer
    </Button>
  );
}

/**
 * One form per weekday. Multiple periods are supported, which is how a
 * Tunisian salon actually works: 09:00–13:00, then 14:00–19:00.
 */
function DayRow({
  businessId,
  weekday,
  periods,
}: {
  businessId: string;
  weekday: number;
  periods: Period[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveHoursAction, idle);
  const [rows, setRows] = useState<{ start: string; end: string }[]>(
    periods.length > 0
      ? periods.map((p) => ({ start: minutesToHHMM(p.startMin), end: minutesToHHMM(p.endMin) }))
      : [],
  );

  if (state.status === 'success') router.refresh();

  return (
    <form action={formAction} className="z-dayrow">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="weekday" value={weekday} />

      <div className="z-dayrow__name">
        <strong>{WEEKDAYS[weekday]}</strong>
        {rows.length === 0 ? <span className="z-help">Fermé</span> : null}
      </div>

      <div className="z-dayrow__periods">
        {rows.map((row, index) => (
          <div key={index} className="z-dayrow__period">
            <input
              type="time"
              name="starts"
              className="z-input"
              value={row.start}
              required
              aria-label={`Ouverture ${index + 1}`}
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((r, i) => (i === index ? { ...r, start: e.target.value } : r)),
                )
              }
            />
            <span aria-hidden="true">–</span>
            <input
              type="time"
              name="ends"
              className="z-input"
              value={row.end}
              required
              aria-label={`Fermeture ${index + 1}`}
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((r, i) => (i === index ? { ...r, end: e.target.value } : r)),
                )
              }
            />
            <button
              type="button"
              className="z-iconbtn"
              onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
              aria-label="Retirer ce créneau"
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          className="z-btn z-btn--ghost z-btn--sm"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              prev.length === 0 ? { start: '09:00', end: '13:00' } : { start: '14:00', end: '19:00' },
            ])
          }
        >
          + Créneau
        </button>
      </div>

      <div className="z-dayrow__actions">
        <DaySubmit />
      </div>

      {state.status === 'error' ? (
        <p className="z-error z-dayrow__error">{state.message}</p>
      ) : null}
    </form>
  );
}

function ExceptionForm({
  businessId,
  staff,
}: {
  businessId: string;
  staff: { id: string; displayName: string }[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(addExceptionAction, idle);
  const [kind, setKind] = useState('CLOSED');
  if (state.status === 'success') router.refresh();

  const needsTimes = kind === 'BREAK' || kind === 'SPECIAL_HOURS';

  return (
    <form action={formAction} className="z-auth__form">
      <input type="hidden" name="businessId" value={businessId} />
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

      <Select label="Type" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="CLOSED">Fermeture exceptionnelle</option>
        <option value="HOLIDAY">Jour férié</option>
        <option value="VACATION">Congés</option>
        <option value="BREAK">Pause</option>
        <option value="SPECIAL_HOURS">Horaires exceptionnels</option>
      </Select>

      <div className="z-auth__row">
        <Input label="Du" name="date" type="date" required />
        <Input label="Au" name="endDate" type="date" optional hint="Laissez vide pour un seul jour." />
      </div>

      {needsTimes ? (
        <div className="z-auth__row">
          <Input label="De" name="startMin" type="time" required />
          <Input label="À" name="endMin" type="time" required />
        </div>
      ) : null}

      {staff.length > 0 ? (
        <Select label="Concerne" name="staffMemberId" optional>
          <option value="">Tout l’établissement</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
            </option>
          ))}
        </Select>
      ) : null}

      <Input label="Motif" name="reason" optional placeholder="Aïd, inventaire, formation…" />

      <Button type="submit">Ajouter</Button>
    </form>
  );
}

function DeleteException({ businessId, exceptionId }: { businessId: string; exceptionId: string }) {
  const router = useRouter();
  const [, formAction] = useActionState(deleteExceptionAction, idle);
  return (
    <form action={formAction} onSubmit={() => setTimeout(() => router.refresh(), 400)}>
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="exceptionId" value={exceptionId} />
      <button type="submit" className="z-iconbtn" aria-label="Supprimer">
        ×
      </button>
    </form>
  );
}

export function HoursManager({
  businessId,
  hours,
  exceptions,
  staff,
}: {
  businessId: string;
  hours: { weekday: number; startMin: number; endMin: number }[];
  exceptions: {
    id: string;
    kind: string;
    date: string;
    endDate: string | null;
    startMin: number | null;
    endMin: number | null;
    reason: string | null;
    staffName: string | null;
  }[];
  staff: { id: string; displayName: string }[];
}) {
  return (
    <div className="z-dash__grid">
      <Panel className="z-dash__panel">
        <div>
          <h2 className="z-profile__h3">Horaires d’ouverture</h2>
          <p className="z-policy">
            Ajoutez plusieurs créneaux pour une coupure déjeuner. Vos disponibilités de
            réservation en découlent directement.
          </p>
        </div>

        <div className="z-days">
          {/* Monday first, Sunday last — how a week is read here. */}
          {[1, 2, 3, 4, 5, 6, 0].map((weekday) => (
            <DayRow
              key={weekday}
              businessId={businessId}
              weekday={weekday}
              periods={hours.filter((h) => h.weekday === weekday)}
            />
          ))}
        </div>
      </Panel>

      <div className="z-stack" style={{ gap: 'var(--z-space-5)' }}>
        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">Fermeture ou congés</h2>
          <ExceptionForm businessId={businessId} staff={staff} />
        </Panel>

        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">À venir</h2>
          {exceptions.length === 0 ? (
            <p className="z-help">Aucune fermeture programmée.</p>
          ) : (
            <ul className="z-exceptions">
              {exceptions.map((exception) => (
                <li key={exception.id}>
                  <div>
                    <Badge tone={exception.kind === 'SPECIAL_HOURS' ? 'accent' : 'warning'}>
                      {KIND_LABEL[exception.kind] ?? exception.kind}
                    </Badge>
                    <p>
                      {exception.date}
                      {exception.endDate && exception.endDate !== exception.date
                        ? ` → ${exception.endDate}`
                        : ''}
                      {exception.startMin !== null
                        ? ` · ${minutesToHHMM(exception.startMin)}–${minutesToHHMM(exception.endMin ?? 0)}`
                        : ''}
                    </p>
                    {exception.reason ? <p className="z-help">{exception.reason}</p> : null}
                    {exception.staffName ? (
                      <p className="z-help">Concerne {exception.staffName}</p>
                    ) : null}
                  </div>
                  <DeleteException businessId={businessId} exceptionId={exception.id} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
