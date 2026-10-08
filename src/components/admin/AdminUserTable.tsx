'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { moderateUserAction } from '@/server/actions/admin';
import { idle } from '@/lib/formState';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { Arrow } from '@/components/ui/Arrow';
import type { Messages } from '@/i18n';
import { interpolate } from '@/i18n/interpolate';
import { type Locale, localePath } from '@/i18n/config';
import { formatCount, formatDate, formatNumber, formatPhone } from '@/i18n/format';

type AdminMessages = Pick<Messages, 'admin' | 'labels' | 'common'>;

type Row = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  status: string;
  locale: string;
  createdAt: string;
  lastLoginAt: string | null;
  roles: string[];
  reservations: number;
  reviews: number;
};

function Submit({ label, variant }: { label: string; variant: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} loading={pending}>
      {label}
    </Button>
  );
}

function UserActions({ row, isSelf, m }: { row: Row; isSelf: boolean; m: AdminMessages }) {
  const u = m.admin.users;
  const router = useRouter();
  const [state, formAction] = useActionState(moderateUserAction, idle);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

  // An admin cannot act on their own account from this table.
  if (isSelf) return <span className="z-help">{u.you}</span>;

  const isAdmin = row.roles.includes('SUPER_ADMIN');

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-2)' }}>
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

      {confirming ? (
        <form action={formAction} className="z-stack" style={{ gap: 'var(--z-space-2)' }}>
          <input type="hidden" name="userId" value={row.id} />
          <input type="hidden" name="decision" value="suspend" />
          <textarea
            name="note"
            className="z-textarea"
            rows={2}
            placeholder={u.notePlaceholder}
            aria-label={m.admin.common.reason}
          />
          <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
            <Submit label={u.suspend} variant="danger" />
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              {m.common.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <div className="z-row" style={{ gap: 'var(--z-space-1)', flexWrap: 'wrap' }}>
          {row.status === 'ACTIVE' ? (
            <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
              {u.suspend}
            </Button>
          ) : (
            <form action={formAction}>
              <input type="hidden" name="userId" value={row.id} />
              <input type="hidden" name="decision" value="reactivate" />
              <Submit label={u.reactivate} variant="primary" />
            </form>
          )}

          <form action={formAction}>
            <input type="hidden" name="userId" value={row.id} />
            <input type="hidden" name="decision" value={isAdmin ? 'revokeAdmin' : 'grantAdmin'} />
            <Submit label={isAdmin ? u.revokeAdmin : u.grantAdmin} variant="secondary" />
          </form>
        </div>
      )}
    </div>
  );
}

export function AdminUserTable({
  currentUserId,
  rows,
  total,
  page,
  pageCount,
  filters,
  m,
  locale,
}: {
  currentUserId: string;
  rows: Row[];
  total: number;
  page: number;
  pageCount: number;
  filters: Record<string, string | undefined>;
  m: AdminMessages;
  locale: Locale;
}) {
  const c = m.admin.common;
  const u = m.admin.users;
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q ?? '');

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    startTransition(() => router.push(localePath(locale, `/admin/users?${next.toString()}`)));
  }

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-5)' }}>
      <h1 className="z-search__title">
        {interpolate(c.headingCount, { title: m.admin.nav.users, count: formatNumber(total, locale) })}
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
          placeholder={u.searchPlaceholder}
          aria-label={c.search}
        />
        <Button type="submit" variant="secondary">
          {c.search}
        </Button>

        <select
          className="z-select"
          style={{ width: 'auto' }}
          value={filters.role ?? ''}
          onChange={(e) => setParam('role', e.target.value || null)}
          aria-label={u.role}
        >
          <option value="">{u.allRoles}</option>
          {Object.entries(m.labels.role).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          className="z-select"
          style={{ width: 'auto' }}
          value={filters.status ?? ''}
          onChange={(e) => setParam('status', e.target.value || null)}
          aria-label={c.status}
        >
          <option value="">{c.allStatuses}</option>
          <option value="ACTIVE">{m.labels.userStatus.ACTIVE}</option>
          <option value="SUSPENDED">{m.labels.userStatus.SUSPENDED}</option>
        </select>
      </form>

      {rows.length === 0 ? (
        <EmptyState title={u.empty} body={c.noResults} />
      ) : (
        <>
          <div className="z-table--scroll">
            <table className="z-table">
              <thead>
                <tr>
                  <th>{u.user}</th>
                  <th>{u.roles}</th>
                  <th>{c.status}</th>
                  <th>{c.activity}</th>
                  <th>{u.lastLogin}</th>
                  <th>{c.actions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      <br />
                      <span className="z-help" dir="ltr">
                        {row.email}
                      </span>
                      {row.phone ? (
                        <>
                          <br />
                          <span className="z-help" dir="ltr">
                            {formatPhone(row.phone)}
                          </span>
                        </>
                      ) : null}
                    </td>
                    <td>
                      <div className="z-row" style={{ gap: 4, flexWrap: 'wrap' }}>
                        {row.roles.map((role) => (
                          <Badge key={role} tone={role === 'SUPER_ADMIN' ? 'gold' : 'neutral'}>
                            {m.labels.role[role as keyof typeof m.labels.role] ?? role}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td>
                      <Badge tone={row.status === 'ACTIVE' ? 'success' : 'danger'}>
                        {m.labels.userStatus[row.status as keyof typeof m.labels.userStatus] ??
                          row.status}
                      </Badge>
                    </td>
                    <td>
                      <span className="z-help">
                        {formatCount(c.reservationsCount, row.reservations, locale)} ·{' '}
                        {formatCount(c.reviewsCount, row.reviews, locale)}
                        <br />
                        {interpolate(u.joinedOn, { date: formatDate(new Date(row.createdAt), locale) })}
                      </span>
                    </td>
                    <td>
                      <span className="z-help">
                        <RelativeTime value={row.lastLoginAt} locale={locale} fallback={u.never} />
                      </span>
                    </td>
                    <td>
                      <UserActions row={row} isSelf={row.id === currentUserId} m={m} />
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
