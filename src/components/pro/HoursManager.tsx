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
import { formatDate, weekdayNames } from '@/i18n/format';
import { LOCALE_META, type Locale } from '@/i18n/config';
import { interpolate } from '@/i18n/interpolate';
import type { Messages } from '@/i18n';

type M = {
  dashSetup: Messages['dashSetup'];
  common: Messages['common'];
  labels: Messages['labels'];
};

const EXCEPTION_KINDS = ['CLOSED', 'HOLIDAY', 'VACATION', 'BREAK', 'SPECIAL_HOURS'] as const;

/** A stored calendar day ("2026-10-12") in the reader's language, never shifted by time zone. */
function formatDay(isoDate: string, locale: Locale): string {
  return formatDate(
    new Date(`${isoDate}T00:00:00Z`),
    locale,
    { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' },
    'UTC',
  );
}

type Period = { startMin: number; endMin: number };

function DaySubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      {label}
    </Button>
  );
}

/**
 * One form per weekday. Multiple periods are supported, which is how a
 * Tunisian salon actually works: 09:00–13:00, then 14:00–19:00.
 */
function DayRow({
  m,
  dayName,
  businessId,
  weekday,
  periods,
}: {
  m: M;
  dayName: string;
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
  const t = m.dashSetup.hours;

  return (
    <form action={formAction} className="z-dayrow">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="weekday" value={weekday} />

      <div className="z-dayrow__name">
        <strong>{dayName}</strong>
        {rows.length === 0 ? <span className="z-help">{t.closed}</span> : null}
      </div>

      <div className="z-dayrow__periods">
        {rows.map((row, index) => (
          <div key={index} className="z-dayrow__period">
            {/* A time range reads left to right in every language: 09:00 – 13:00. */}
            <span className="z-dayrow__range" dir="ltr">
              <input
                type="time"
                name="starts"
                className="z-input"
                value={row.start}
                required
                aria-label={interpolate(t.opening, { n: index + 1 })}
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
                aria-label={interpolate(t.closing, { n: index + 1 })}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, i) => (i === index ? { ...r, end: e.target.value } : r)),
                  )
                }
              />
            </span>
            <button
              type="button"
              className="z-iconbtn"
              onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
              aria-label={t.removeSlot}
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
          + {t.addSlot}
        </button>
      </div>

      <div className="z-dayrow__actions">
        <DaySubmit label={m.common.save} />
      </div>

      {state.status === 'error' ? (
        <p className="z-error z-dayrow__error">{state.message}</p>
      ) : null}
    </form>
  );
}

function ExceptionForm({
  m,
  businessId,
  staff,
}: {
  m: M;
  businessId: string;
  staff: { id: string; displayName: string }[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(addExceptionAction, idle);
  const [kind, setKind] = useState('CLOSED');
  if (state.status === 'success') router.refresh();

  const needsTimes = kind === 'BREAK' || kind === 'SPECIAL_HOURS';
  const t = m.dashSetup.hours;

  return (
    <form action={formAction} className="z-auth__form">
      <input type="hidden" name="businessId" value={businessId} />
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

      <Select label={t.type} name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
        {EXCEPTION_KINDS.map((value) => (
          <option key={value} value={value}>
            {m.labels.exceptionKind[value]}
          </option>
        ))}
      </Select>

      <div className="z-auth__row">
        <Input label={t.from} name="date" type="date" required />
        <Input label={t.to} name="endDate" type="date" optional hint={t.toHint} />
      </div>

      {needsTimes ? (
        <div className="z-auth__row">
          <Input label={t.timeFrom} name="startMin" type="time" required dir="ltr" />
          <Input label={t.timeTo} name="endMin" type="time" required dir="ltr" />
        </div>
      ) : null}

      {staff.length > 0 ? (
        <Select label={t.appliesTo} name="staffMemberId" optional>
          <option value="">{t.wholeBusiness}</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
            </option>
          ))}
        </Select>
      ) : null}

      <Input label={t.reason} name="reason" optional placeholder={t.reasonPlaceholder} />

      <Button type="submit">{m.common.add}</Button>
    </form>
  );
}

function DeleteException({
  label,
  businessId,
  exceptionId,
}: {
  label: string;
  businessId: string;
  exceptionId: string;
}) {
  const router = useRouter();
  const [, formAction] = useActionState(deleteExceptionAction, idle);
  return (
    <form action={formAction} onSubmit={() => setTimeout(() => router.refresh(), 400)}>
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="exceptionId" value={exceptionId} />
      <button type="submit" className="z-iconbtn" aria-label={label} title={label}>
        ×
      </button>
    </form>
  );
}

export function HoursManager({
  m,
  locale,
  businessId,
  hours,
  exceptions,
  staff,
}: {
  m: M;
  locale: Locale;
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
  const t = m.dashSetup.hours;
  const intl = LOCALE_META[locale].intl;
  // Intl writes French weekdays in lower case; a row heading wants a capital.
  const days = weekdayNames(locale).map(
    (name) => name.charAt(0).toLocaleUpperCase(intl) + name.slice(1),
  );

  return (
    <div className="z-dash__grid">
      <Panel className="z-dash__panel">
        <div>
          <h2 className="z-profile__h3">{t.heading}</h2>
          <p className="z-policy">{t.intro}</p>
        </div>

        <div className="z-days">
          {/* Monday first, Sunday last — how a week is read here. */}
          {[1, 2, 3, 4, 5, 6, 0].map((weekday) => (
            <DayRow
              key={weekday}
              m={m}
              dayName={days[weekday] ?? ''}
              businessId={businessId}
              weekday={weekday}
              periods={hours.filter((h) => h.weekday === weekday)}
            />
          ))}
        </div>
      </Panel>

      <div className="z-stack" style={{ gap: 'var(--z-space-5)' }}>
        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">{t.exceptionsHeading}</h2>
          <ExceptionForm m={m} businessId={businessId} staff={staff} />
        </Panel>

        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">{t.upcoming}</h2>
          {exceptions.length === 0 ? (
            <p className="z-help">{t.noUpcoming}</p>
          ) : (
            <ul className="z-exceptions">
              {exceptions.map((exception) => (
                <li key={exception.id}>
                  <div>
                    <Badge tone={exception.kind === 'SPECIAL_HOURS' ? 'accent' : 'warning'}>
                      {m.labels.exceptionKind[
                        exception.kind as keyof Messages['labels']['exceptionKind']
                      ] ?? exception.kind}
                    </Badge>
                    <p>
                      {exception.endDate && exception.endDate !== exception.date
                        ? interpolate(t.dateRange, {
                            start: formatDay(exception.date, locale),
                            end: formatDay(exception.endDate, locale),
                          })
                        : formatDay(exception.date, locale)}
                      {exception.startMin !== null ? (
                        <>
                          {' · '}
                          <bdi dir="ltr">
                            {minutesToHHMM(exception.startMin)}–
                            {minutesToHHMM(exception.endMin ?? 0)}
                          </bdi>
                        </>
                      ) : null}
                    </p>
                    {exception.reason ? <p className="z-help">{exception.reason}</p> : null}
                    {exception.staffName ? (
                      <p className="z-help">
                        {interpolate(t.appliesToName, { name: exception.staffName })}
                      </p>
                    ) : null}
                  </div>
                  <DeleteException
                    label={t.deleteException}
                    businessId={businessId}
                    exceptionId={exception.id}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
