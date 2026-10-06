'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { EmptyState } from '@/components/ui/Primitives';
import { addDays } from '@/domain/scheduling/time';

type Event = {
  id: string;
  reference: string;
  status: string;
  startAt: string;
  endAt: string;
  customerName: string;
  staffName: string;
  serviceName: string;
};

const ACTIVE = new Set(['PENDING', 'CONFIRMED', 'COMPLETED']);

/**
 * Day and week calendar.
 *
 * Appointments are absolutely positioned against a minute scale, so an
 * overlapping pair (different professionals, same hour) sits side by side
 * rather than hiding one another. On a phone the week view collapses to a
 * scrollable agenda list, which is readable where a 7-column grid is not.
 */
export function CalendarView({
  timezone,
  from,
  today,
  view,
  span,
  dayStartMin,
  dayEndMin,
  staff,
  selectedStaff,
  events,
}: {
  timezone: string;
  from: string;
  today: string;
  view: 'day' | 'week';
  span: number;
  dayStartMin: number;
  dayEndMin: number;
  staff: { id: string; displayName: string }[];
  selectedStaff: string | null;
  events: Event[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function go(next: Partial<{ from: string; view: string; staff: string | null }>) {
    const query = new URLSearchParams(params.toString());
    if (next.from) query.set('from', next.from);
    if (next.view) query.set('view', next.view);
    if (next.staff !== undefined) {
      if (next.staff) query.set('staff', next.staff);
      else query.delete('staff');
    }
    router.push(`/pro/dashboard/calendar?${query.toString()}`);
  }

  const days = useMemo(
    () =>
      Array.from({ length: span }, (_, i) => {
        const key = addDays(from, i);
        const date = new Date(`${key}T12:00:00Z`);
        return {
          key,
          label: new Intl.DateTimeFormat('fr-TN', { weekday: 'short', day: 'numeric', month: 'short' }).format(date),
          isToday: key === today,
        };
      }),
    [from, span, today],
  );

  const totalMinutes = Math.max(60, dayEndMin - dayStartMin);
  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    for (let m = Math.ceil(dayStartMin / 60) * 60; m <= dayEndMin; m += 60) marks.push(m);
    return marks;
  }, [dayStartMin, dayEndMin]);

  /** Local minutes-from-midnight for an instant, in the business timezone. */
  function localMinutes(iso: string): { day: string; minutes: number } {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(iso));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
    const hour = Number(get('hour')) % 24;
    return {
      day: `${get('year')}-${get('month')}-${get('day')}`,
      minutes: hour * 60 + Number(get('minute')),
    };
  }

  const visible = events.filter((e) => ACTIVE.has(e.status));

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-4)' }}>
      <div className="z-cal__toolbar">
        <div className="z-row" style={{ gap: 'var(--z-space-2)' }}>
          <button type="button" className="z-btn z-btn--secondary z-btn--sm" onClick={() => go({ from: addDays(from, -span) })}>
            ←
          </button>
          <button type="button" className="z-btn z-btn--secondary z-btn--sm" onClick={() => go({ from: today })}>
            Aujourd’hui
          </button>
          <button type="button" className="z-btn z-btn--secondary z-btn--sm" onClick={() => go({ from: addDays(from, span) })}>
            →
          </button>
        </div>

        <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
          <div className="z-segmented" role="group" aria-label="Vue">
            <button
              type="button"
              className={view === 'day' ? 'is-active' : ''}
              onClick={() => go({ view: 'day' })}
            >
              Jour
            </button>
            <button
              type="button"
              className={view === 'week' ? 'is-active' : ''}
              onClick={() => go({ view: 'week' })}
            >
              Semaine
            </button>
          </div>

          <select
            className="z-select"
            style={{ width: 'auto' }}
            value={selectedStaff ?? ''}
            onChange={(e) => go({ staff: e.target.value || null })}
            aria-label="Filtrer par professionnel"
          >
            <option value="">Toute l’équipe</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Aucun rendez-vous sur cette période"
          body="Changez de semaine, ou attendez vos prochaines réservations."
        />
      ) : null}

      {/* Desktop grid */}
      <div className="z-cal" style={{ ['--cal-days' as string]: String(span) }}>
        <div className="z-cal__gutter">
          {hourMarks.map((mark) => (
            <span
              key={mark}
              className="z-cal__hour"
              style={{ top: `${((mark - dayStartMin) / totalMinutes) * 100}%` }}
            >
              {String(Math.floor(mark / 60)).padStart(2, '0')}:00
            </span>
          ))}
        </div>

        <div className="z-cal__days">
          {days.map((day) => {
            const dayEvents = visible
              .map((event) => ({ event, start: localMinutes(event.startAt), end: localMinutes(event.endAt) }))
              .filter((x) => x.start.day === day.key);

            return (
              <div key={day.key} className={`z-cal__day ${day.isToday ? 'is-today' : ''}`}>
                <header>{day.label}</header>
                <div className="z-cal__canvas">
                  {hourMarks.map((mark) => (
                    <span
                      key={mark}
                      className="z-cal__line"
                      style={{ top: `${((mark - dayStartMin) / totalMinutes) * 100}%` }}
                    />
                  ))}

                  {dayEvents.map(({ event, start, end }, index) => {
                    const top = ((start.minutes - dayStartMin) / totalMinutes) * 100;
                    const height = Math.max(
                      3,
                      ((end.minutes - start.minutes) / totalMinutes) * 100,
                    );
                    // Side-by-side when two appointments share the hour.
                    const overlapping = dayEvents.filter(
                      (other) =>
                        other.start.minutes < end.minutes && start.minutes < other.end.minutes,
                    );
                    const column = overlapping.findIndex((o) => o.event.id === event.id);
                    const width = 100 / Math.max(1, overlapping.length);
                    // A 30-minute block cannot hold three lines; show only what
                    // fits rather than letting the text spill.
                    const durationMin = end.minutes - start.minutes;
                    const density = durationMin < 35 ? 'tiny' : durationMin < 55 ? 'short' : 'full';

                    return (
                      <Link
                        key={event.id}
                        href={`/reservations/${event.reference}`}
                        className={`z-cal__event is-${event.status.toLowerCase()} is-${density}`}
                        style={{
                          top: `${top}%`,
                          height: `${height}%`,
                          insetInlineStart: `${column * width}%`,
                          width: `calc(${width}% - 3px)`,
                          zIndex: index + 1,
                        }}
                      >
                        <strong>{event.customerName}</strong>
                        {density !== 'tiny' ? <span>{event.serviceName}</span> : null}
                        {density === 'full' ? <span>{event.staffName}</span> : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile agenda — a 7-column grid is unusable on a phone. */}
      <div className="z-cal-list">
        {days.map((day) => {
          const dayEvents = visible
            .map((event) => ({ event, start: localMinutes(event.startAt) }))
            .filter((x) => x.start.day === day.key)
            .sort((a, b) => a.start.minutes - b.start.minutes);
          if (dayEvents.length === 0) return null;

          return (
            <section key={day.key}>
              <h3>{day.label}</h3>
              <ul>
                {dayEvents.map(({ event, start }) => (
                  <li key={event.id}>
                    <Link href={`/reservations/${event.reference}`}>
                      <span className="z-cal-list__time">
                        {String(Math.floor(start.minutes / 60)).padStart(2, '0')}:
                        {String(start.minutes % 60).padStart(2, '0')}
                      </span>
                      <span>
                        <strong>{event.customerName}</strong>
                        <br />
                        <span className="z-help">
                          {event.serviceName} · {event.staffName}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
