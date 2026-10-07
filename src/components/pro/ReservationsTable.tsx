'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { Arrow } from '@/components/ui/Arrow';
import { transitionReservationAction } from '@/server/actions/proReservations';
import { idle } from '@/lib/formState';
import { formatPrice } from '@/i18n/format';
import { interpolate } from '@/i18n/interpolate';
import type { Messages } from '@/i18n';
import { LOCALE_META, localePath, type Locale } from '@/i18n/config';

type Dict = {
  reservations: Messages['dash']['reservations'];
  shared: Messages['dash']['shared'];
  status: Messages['status'];
  common: Messages['common'];
};

type Row = {
  id: string;
  reference: string;
  status: string;
  startAt: string;
  customerName: string;
  customerPhone: string | null;
  staffName: string;
  serviceName: string;
  amount: number;
  customerNote: string | null;
  internalNote: string | null;
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

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * Which transitions the business may apply, mirroring the state machine.
 * The ones that tell the customer bad news ask first.
 */
function actionsFor(
  status: string,
  d: Dict['reservations'],
): { action: string; label: string; variant: Variant; ask?: string }[] {
  if (status === 'PENDING') {
    return [
      { action: 'confirm', label: d.actionConfirm, variant: 'primary' },
      { action: 'cancel', label: d.actionDecline, variant: 'ghost', ask: d.confirmDecline },
    ];
  }
  if (status === 'CONFIRMED') {
    return [
      { action: 'complete', label: d.actionComplete, variant: 'secondary' },
      { action: 'noShow', label: d.actionNoShow, variant: 'ghost', ask: d.confirmNoShow },
      { action: 'cancel', label: d.actionCancel, variant: 'ghost', ask: d.confirmCancel },
    ];
  }
  return [];
}

function ActionButton({ label, variant }: { label: string; variant: Variant }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} loading={pending}>
      {label}
    </Button>
  );
}

function RowActions({
  businessId,
  row,
  d,
}: {
  businessId: string;
  row: Row;
  d: Dict['reservations'];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(transitionReservationAction, idle);
  if (state.status === 'success') router.refresh();

  const actions = actionsFor(row.status, d);
  if (actions.length === 0) return <span className="z-help">—</span>;

  return (
    <div className="z-row" style={{ gap: 'var(--z-space-1)', flexWrap: 'wrap' }}>
      {actions.map((item) => (
        <form
          key={item.action}
          action={formAction}
          onSubmit={(e) => {
            const ask = item.ask && interpolate(item.ask, { customer: row.customerName });
            if (ask && !window.confirm(ask)) e.preventDefault();
          }}
        >
          <input type="hidden" name="businessId" value={businessId} />
          <input type="hidden" name="reservationId" value={row.id} />
          <input type="hidden" name="action" value={item.action} />
          <ActionButton label={item.label} variant={item.variant} />
        </form>
      ))}
      {state.status === 'error' ? <span className="z-error">{state.message}</span> : null}
    </div>
  );
}

export function ReservationsTable({
  m,
  locale,
  businessId,
  timezone,
  currency,
  rows,
  staff,
  total,
  page,
  perPage,
  filters,
  created,
}: {
  m: Dict;
  locale: Locale;
  businessId: string;
  timezone: string;
  currency: string;
  rows: Row[];
  staff: { id: string; displayName: string }[];
  total: number;
  page: number;
  perPage: number;
  filters: Record<string, string | undefined>;
  /** Reference of a just-created appointment, to confirm it landed. */
  created?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(null);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    // A new filter starts back on the first page; turning the page keeps it.
    if (key !== 'page') next.delete('page');
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() =>
      router.push(localePath(locale, `/pro/dashboard/reservations?${next.toString()}`)),
    );
  }

  const d = m.reservations;
  const pageCount = Math.ceil(total / perPage);
  const filtered = Boolean(filters.status || filters.staff);
  const [createdBefore = '', createdAfter = ''] = d.created.split('{reference}');
  const fmt = new Intl.DateTimeFormat(LOCALE_META[locale].intl, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  });

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-5)' }}>
      <div className="z-dash__panel-head">
        <h2 className="z-profile__h3">{interpolate(d.title, { count: total })}</h2>
        <div className="z-row z-row--gap" style={{ flexWrap: 'wrap' }}>
          <Link
            className="z-btn z-btn--primary z-btn--sm"
            href={localePath(locale, '/pro/dashboard/reservations/new')}
          >
            + {m.shared.newAppointment}
          </Link>
          <Link href={localePath(locale, '/pro/dashboard/calendar')}>
            {d.calendarView} <Arrow />
          </Link>
        </div>
      </div>

      {created ? (
        <Alert tone="success">
          {createdBefore}
          <strong dir="ltr">{created}</strong>
          {createdAfter}
        </Alert>
      ) : null}

      <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
        <select
          className="z-select"
          style={{ width: 'auto' }}
          value={filters.status ?? ''}
          onChange={(e) => setParam('status', e.target.value || null)}
          aria-label={d.statusFilter}
        >
          <option value="">{d.allStatuses}</option>
          {Object.keys(STATUS_TONE).map((value) => (
            <option key={value} value={value}>
              {m.status[value as keyof Dict['status']] ?? value}
            </option>
          ))}
        </select>

        <select
          className="z-select"
          style={{ width: 'auto' }}
          value={filters.staff ?? ''}
          onChange={(e) => setParam('staff', e.target.value || null)}
          aria-label={m.shared.staffFilter}
        >
          <option value="">{m.shared.allTeam}</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={d.emptyTitle}
          body={filtered ? d.emptyFilteredBody : d.emptyBody}
        />
      ) : (
        <>
          <div className="z-table--scroll">
            <table className="z-table">
              <thead>
                <tr>
                  <th>{d.colWhen}</th>
                  <th>{d.colCustomer}</th>
                  <th>{d.colService}</th>
                  <th>{d.colStaff}</th>
                  <th>{d.colStatus}</th>
                  <th>{d.colAmount}</th>
                  <th>{d.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{fmt.format(new Date(row.startAt))}</strong>
                      <br />
                      <span className="z-help" dir="ltr">
                        {row.reference}
                      </span>
                    </td>
                    <td>
                      {row.customerName}
                      {row.customerPhone ? (
                        <>
                          <br />
                          <a href={`tel:${row.customerPhone}`} className="z-help" dir="ltr">
                            {row.customerPhone}
                          </a>
                        </>
                      ) : null}
                      {row.customerNote ? (
                        <>
                          <br />
                          <button
                            type="button"
                            className="z-linkbtn"
                            onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                            aria-expanded={expanded === row.id}
                          >
                            {expanded === row.id ? d.hideNote : d.showNote}
                          </button>
                          {expanded === row.id ? (
                            <p className="z-note">{row.customerNote}</p>
                          ) : null}
                        </>
                      ) : null}
                    </td>
                    <td>{row.serviceName}</td>
                    <td>{row.staffName}</td>
                    <td>
                      <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>
                        {m.status[row.status as keyof Dict['status']] ?? row.status}
                      </Badge>
                    </td>
                    <td>{formatPrice(row.amount, locale, currency)}</td>
                    <td>
                      <RowActions businessId={businessId} row={row} d={d} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 ? (
            <nav className="z-pagination" aria-label={d.pagination}>
              {page > 1 ? (
                <button
                  type="button"
                  className="z-btn z-btn--secondary z-btn--sm"
                  onClick={() => setParam('page', String(page - 1))}
                >
                  <Arrow to="back" /> {m.common.previous}
                </button>
              ) : null}
              <span className="z-pagination__state">
                {interpolate(d.pageOf, { page, count: pageCount })}
              </span>
              {page < pageCount ? (
                <button
                  type="button"
                  className="z-btn z-btn--secondary z-btn--sm"
                  onClick={() => setParam('page', String(page + 1))}
                >
                  {m.common.next} <Arrow />
                </button>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
