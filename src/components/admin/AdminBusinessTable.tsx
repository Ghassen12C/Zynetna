'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { moderateBusinessAction } from '@/server/actions/admin';
import { idle } from '@/lib/formState';
import { Arrow } from '@/components/ui/Arrow';
import type { Messages } from '@/i18n';
import { interpolate } from '@/i18n/interpolate';
import { type Locale, localePath } from '@/i18n/config';
import { formatCount, formatDate, formatNumber } from '@/i18n/format';

type AdminMessages = Pick<Messages, 'admin' | 'labels' | 'common'>;

type Row = {
  id: string;
  slug: string;
  name: string;
  status: string;
  verification: string;
  ratingAverage: number;
  ratingCount: number;
  createdAt: string;
  ownerEmail: string;
  ownerName: string;
  cityName: string | null;
  subscriptionStatus: string | null;
  reservations: number;
  services: number;
  staff: number;
};

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'accent'> = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'danger',
  REJECTED: 'danger',
};

function ModerateButton({ label, variant }: { label: string; variant: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} loading={pending}>
      {label}
    </Button>
  );
}

/**
 * Moderation panel for one business.
 *
 * Reject and suspend require a written reason — the owner is notified with it,
 * and the audit log keeps it. A decision with no reason is not a decision.
 */
function Moderate({ row, m }: { row: Row; m: AdminMessages }) {
  const b = m.admin.businesses;
  const router = useRouter();
  const [state, formAction] = useActionState(moderateBusinessAction, idle);
  const [needsNote, setNeedsNote] = useState<string | null>(null);

  if (state.status === 'success') router.refresh();

  const decisions: { key: string; label: string; variant: 'primary' | 'secondary' | 'ghost' | 'danger'; note?: boolean }[] = [];
  if (row.status === 'PENDING_REVIEW' || row.status === 'DRAFT') {
    decisions.push({ key: 'approve', label: b.approve, variant: 'primary' });
    decisions.push({ key: 'reject', label: b.reject, variant: 'ghost', note: true });
  }
  if (row.status === 'ACTIVE') {
    decisions.push(
      row.verification === 'VERIFIED'
        ? { key: 'unverify', label: b.unverify, variant: 'ghost' }
        : { key: 'verify', label: b.verify, variant: 'secondary' },
    );
    decisions.push({ key: 'suspend', label: b.suspend, variant: 'ghost', note: true });
  }
  if (row.status === 'SUSPENDED' || row.status === 'REJECTED') {
    decisions.push({ key: 'reactivate', label: b.reactivate, variant: 'primary' });
  }

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-2)' }}>
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

      {needsNote ? (
        <form action={formAction} className="z-stack" style={{ gap: 'var(--z-space-2)' }}>
          <input type="hidden" name="businessId" value={row.id} />
          <input type="hidden" name="decision" value={needsNote} />
          <textarea
            name="note"
            className="z-textarea"
            required
            rows={2}
            placeholder={b.notePlaceholder}
            aria-label={m.admin.common.reason}
          />
          <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
            <ModerateButton label={m.common.confirm} variant="danger" />
            <Button type="button" variant="ghost" size="sm" onClick={() => setNeedsNote(null)}>
              {m.common.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <div className="z-row" style={{ gap: 'var(--z-space-1)', flexWrap: 'wrap' }}>
          {decisions.map((decision) =>
            decision.note ? (
              <Button
                key={decision.key}
                size="sm"
                variant={decision.variant}
                onClick={() => setNeedsNote(decision.key)}
              >
                {decision.label}
              </Button>
            ) : (
              <form key={decision.key} action={formAction}>
                <input type="hidden" name="businessId" value={row.id} />
                <input type="hidden" name="decision" value={decision.key} />
                <ModerateButton label={decision.label} variant={decision.variant} />
              </form>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function AdminBusinessTable({
  rows,
  total,
  page,
  pageCount,
  filters,
  m,
  locale,
}: {
  rows: Row[];
  total: number;
  page: number;
  pageCount: number;
  filters: Record<string, string | undefined>;
  m: AdminMessages;
  locale: Locale;
}) {
  const c = m.admin.common;
  const b = m.admin.businesses;
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q ?? '');

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    startTransition(() => router.push(localePath(locale, `/admin/businesses?${next.toString()}`)));
  }

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-5)' }}>
      <h1 className="z-search__title">
        {interpolate(c.headingCount, {
          title: m.admin.nav.businesses,
          count: formatNumber(total, locale),
        })}
      </h1>

      <form
        className="z-row"
        style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}
        onSubmit={(e) => {
          e.preventDefault();
          setParam('q', query || null);
        }}
      >
        <input
          className="z-input"
          style={{ width: 'auto', minWidth: 220 }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={b.searchPlaceholder}
          aria-label={c.search}
        />
        <Button type="submit" variant="secondary">
          {c.search}
        </Button>

        <select
          className="z-select"
          style={{ width: 'auto' }}
          value={filters.status ?? ''}
          onChange={(e) => setParam('status', e.target.value || null)}
          aria-label={c.status}
        >
          <option value="">{c.allStatuses}</option>
          {Object.entries(m.labels.businessStatus).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          className="z-select"
          style={{ width: 'auto' }}
          value={filters.verification ?? ''}
          onChange={(e) => setParam('verification', e.target.value || null)}
          aria-label={b.verification}
        >
          <option value="">{b.allVerifications}</option>
          {(['VERIFIED', 'PENDING', 'UNVERIFIED', 'REJECTED'] as const).map((value) => (
            <option key={value} value={value}>
              {m.labels.verification[value]}
            </option>
          ))}
        </select>
      </form>

      {rows.length === 0 ? (
        <EmptyState title={b.empty} body={c.noResults} />
      ) : (
        <>
          <div className="z-table--scroll">
            <table className="z-table">
              <thead>
                <tr>
                  <th>{c.business}</th>
                  <th>{c.owner}</th>
                  <th>{c.status}</th>
                  <th>{b.subscription}</th>
                  <th>{c.activity}</th>
                  <th>{b.moderation}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link
                        href={localePath(locale, `/business/${row.slug}`)}
                        className="z-ranklist__name"
                      >
                        {row.name}
                      </Link>
                      <br />
                      <span className="z-help">
                        {row.cityName ?? '—'} ·{' '}
                        {interpolate(b.createdOn, {
                          date: formatDate(new Date(row.createdAt), locale),
                        })}
                      </span>
                    </td>
                    <td>
                      {row.ownerName}
                      <br />
                      <span className="z-help" dir="ltr">
                        {row.ownerEmail}
                      </span>
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>
                        {m.labels.businessStatus[row.status as keyof typeof m.labels.businessStatus] ??
                          row.status}
                      </Badge>
                      {row.verification === 'VERIFIED' ? (
                        <>
                          <br />
                          <Badge tone="accent">✓ {m.labels.verification.VERIFIED}</Badge>
                        </>
                      ) : null}
                    </td>
                    <td>
                      <span className="z-help">
                        {row.subscriptionStatus
                          ? (m.labels.subscriptionStatus[
                              row.subscriptionStatus as keyof typeof m.labels.subscriptionStatus
                            ] ?? row.subscriptionStatus)
                          : '—'}
                      </span>
                    </td>
                    <td>
                      <span className="z-help">
                        {formatCount(c.reservationsCount, row.reservations, locale)} ·{' '}
                        {formatCount(c.servicesCount, row.services, locale)} ·{' '}
                        {formatCount(c.staffCount, row.staff, locale)}
                        <br />
                        {row.ratingCount > 0
                          ? interpolate(c.rating, {
                              rating: formatNumber(Math.round(row.ratingAverage * 10) / 10, locale),
                              count: formatNumber(row.ratingCount, locale),
                            })
                          : c.noReviews}
                      </span>
                    </td>
                    <td>
                      <Moderate row={row} m={m} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 ? (
            <nav className="z-pagination" aria-label={c.pagination}>
              {page > 1 ? (
                <button type="button" className="z-btn z-btn--secondary z-btn--sm" onClick={() => setParam('page', String(page - 1))}>
                  <Arrow to="back" /> {m.common.previous}
                </button>
              ) : null}
              <span className="z-pagination__state">
                {interpolate(c.pageState, {
                  page: formatNumber(page, locale),
                  total: formatNumber(pageCount, locale),
                })}
              </span>
              {page < pageCount ? (
                <button type="button" className="z-btn z-btn--secondary z-btn--sm" onClick={() => setParam('page', String(page + 1))}>
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
