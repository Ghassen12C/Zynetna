'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Badge, Panel } from '@/components/ui/Primitives';
import {
  addExceptionAction,
  clearStaffHoursAction,
  deleteExceptionAction,
  saveHoursAction,
} from '@/server/actions/business';
import { idle } from '@/lib/formState';
import { hhmmToMinutes, minutesToHHMM } from '@/domain/scheduling/time';
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

/** Every quarter hour of the day, 00:00 to 24:00, in minutes. */
const QUARTERS = Array.from({ length: 97 }, (_, i) => i * 15);

/**
 * A 24-hour time picker. The browser's own time input follows the browser's
 * language (09:00 AM on an English Chrome, whatever the page's language);
 * a select reads 09:00 everywhere and limits choices to quarter hours.
 * `as` decides what the form receives: "HH:MM" or minutes since midnight.
 */
function TimeSelect({
  name,
  value,
  onChange,
  label,
  as = 'hhmm',
}: {
  name: string;
  value: number;
  onChange?: (minutes: number) => void;
  label: string;
  as?: 'hhmm' | 'minutes';
}) {
  const options = QUARTERS.includes(value) ? QUARTERS : [...QUARTERS, value].sort((a, b) => a - b);
  return (
    <select
      name={name}
      className="z-select z-timeselect"
      aria-label={label}
      dir="ltr"
      value={as === 'hhmm' ? minutesToHHMM(value) : String(value)}
      onChange={(e) =>
        onChange?.(as === 'hhmm' ? hhmmToMinutes(e.target.value) : Number(e.target.value))
      }
    >
      {options.map((minutes) => (
        <option key={minutes} value={as === 'hhmm' ? minutesToHHMM(minutes) : String(minutes)}>
          {minutesToHHMM(minutes)}
        </option>
      ))}
    </select>
  );
}

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
  staffMemberId,
  ownWeek = false,
}: {
  m: M;
  dayName: string;
  businessId: string;
  weekday: number;
  periods: Period[];
  /** Set when editing one professional's own week instead of the business's. */
  staffMemberId?: string;
  /** Whether that professional already has a week of their own. */
  ownWeek?: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveHoursAction, idle);
  const [rows, setRows] = useState<{ start: number; end: number }[]>(
    periods.map((p) => ({ start: p.startMin, end: p.endMin })),
  );

  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);
  const t = m.dashSetup.hours;

  return (
    <form action={formAction} className="z-dayrow">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="weekday" value={weekday} />
      {staffMemberId ? <input type="hidden" name="staffMemberId" value={staffMemberId} /> : null}

      <div className="z-dayrow__name">
        <strong>{dayName}</strong>
        {rows.length === 0 ? (
          <span className="z-help">
            {!staffMemberId ? t.closed : ownWeek ? t.dayOff : t.followsBusiness}
          </span>
        ) : null}
      </div>

      <div className="z-dayrow__periods">
        {rows.map((row, index) => (
          <div key={index} className="z-dayrow__period">
            {/* The fields follow the page's reading order ("from" first: on the
                right in Arabic); each time itself is written 09:00 in any language. */}
            <span className="z-dayrow__range">
              <TimeSelect
                name="starts"
                value={row.start}
                label={interpolate(t.opening, { n: index + 1 })}
                onChange={(start) =>
                  setRows((prev) => prev.map((r, i) => (i === index ? { ...r, start } : r)))
                }
              />
              <span aria-hidden="true">–</span>
              <TimeSelect
                name="ends"
                value={row.end}
                label={interpolate(t.closing, { n: index + 1 })}
                onChange={(end) =>
                  setRows((prev) => prev.map((r, i) => (i === index ? { ...r, end } : r)))
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
              prev.length === 0 ? { start: 540, end: 780 } : { start: 840, end: 1140 },
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
  const [breakFrom, setBreakFrom] = useState(720);
  const [breakTo, setBreakTo] = useState(840);
  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

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
          <label className="z-field">
            <span className="z-label">{t.timeFrom}</span>
            <TimeSelect name="startMin" value={breakFrom} onChange={setBreakFrom} label={t.timeFrom} as="minutes" />
          </label>
          <label className="z-field">
            <span className="z-label">{t.timeTo}</span>
            <TimeSelect name="endMin" value={breakTo} onChange={setBreakTo} label={t.timeTo} as="minutes" />
          </label>
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

function ClearStaffHours({
  label,
  businessId,
  staffMemberId,
}: {
  label: string;
  businessId: string;
  staffMemberId: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(clearStaffHoursAction, idle);
  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);
  return (
    <form action={formAction}>
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="staffMemberId" value={staffMemberId} />
      <DaySubmitGhost label={label} />
      {state.status === 'error' ? <p className="z-error">{state.message}</p> : null}
    </form>
  );
}

function DaySubmitGhost({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="ghost" loading={pending}>
      {label}
    </Button>
  );
}

export function HoursManager({
  m,
  locale,
  businessId,
  hours,
  exceptions,
  staff,
  staffHours,
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
  staffHours: { staffMemberId: string; weekday: number; startMin: number; endMin: number }[];
}) {
  const t = m.dashSetup.hours;
  const intl = LOCALE_META[locale].intl;
  // Whose week is on screen: '' for the business, or a professional's id.
  const [who, setWho] = useState('');
  const member = staff.find((s) => s.id === who);
  const memberHours = staffHours.filter((h) => h.staffMemberId === who);
  const week = member ? memberHours : hours;
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

        {staff.length > 0 ? (
          <div className="z-whose" role="group" aria-label={t.whoseHours}>
            <span className="z-label">{t.whoseHours}</span>
            <div className="z-chips">
              {[{ id: '', displayName: t.wholeBusiness }, ...staff].map((option) => (
                <button
                  key={option.id || 'business'}
                  type="button"
                  className="z-chip"
                  aria-pressed={who === option.id}
                  onClick={() => setWho(option.id)}
                >
                  <span dir="auto">{option.displayName}</span>
                </button>
              ))}
            </div>
            {member ? (
              <div className="z-whose__note">
                <p className="z-policy">
                  {interpolate(memberHours.length > 0 ? t.staffOwnWeek : t.staffFollows, {
                    name: member.displayName,
                  })}
                </p>
                {memberHours.length > 0 ? (
                  <ClearStaffHours
                    label={t.useBusinessHours}
                    businessId={businessId}
                    staffMemberId={member.id}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Keyed on whose week it is, so each form starts from that week. */}
        <div className="z-days" key={who || 'business'}>
          {/* Monday first, Sunday last — how a week is read here. */}
          {[1, 2, 3, 4, 5, 6, 0].map((weekday) => (
            <DayRow
              key={weekday}
              m={m}
              dayName={days[weekday] ?? ''}
              businessId={businessId}
              weekday={weekday}
              periods={week.filter((h) => h.weekday === weekday)}
              staffMemberId={member?.id}
              ownWeek={memberHours.length > 0}
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
