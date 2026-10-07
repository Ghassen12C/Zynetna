import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { requireSuperAdmin } from '@/server/auth/guard';
import { Arrow } from '@/components/ui/Arrow';
import { translate } from '@/i18n/server';
import { formatDateTime, formatNumber } from '@/i18n/format';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.admin.nav.audit, robots: { index: false } };
}

/** Actions that change who can do what, or what the public sees. */
const SENSITIVE = new Set([
  'business.suspended', 'business.rejected', 'user.suspended',
  'user.role_granted', 'user.role_revoked', 'setting.updated', 'flag.updated',
]);

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  await requireSuperAdmin();
  const { m, locale, t, path } = await translate();
  const c = m.admin.common;
  const a = m.admin.audit;
  // Known codes read as words; an unknown code stays visible as is.
  const actionLabel = (code: string) => a.actions[code] ?? code;
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const perPage = 50;

  const where = params.action ? { action: params.action } : {};
  const [logs, total, actions] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { actor: { select: { email: true, firstName: true, lastName: true } } },
    }),
    db.auditLog.count({ where }),
    db.auditLog.groupBy({ by: ['action'], _count: { action: true }, orderBy: { _count: { action: 'desc' } } }),
  ]);

  const pageCount = Math.ceil(total / perPage);
  const pageHref = (p: number) =>
    `${path('/admin/audit')}?page=${p}${params.action ? `&action=${params.action}` : ''}`;

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-5)' }}>
      <div>
        <h1 className="z-search__title">
          {t(c.headingCount, { title: m.admin.nav.audit, count: formatNumber(total, locale) })}
        </h1>
        <p className="z-policy">{a.lead}</p>
      </div>

      <form className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
        <select
          className="z-select"
          style={{ width: 'auto' }}
          name="action"
          defaultValue={params.action ?? ''}
          aria-label={a.filterLabel}
        >
          <option value="">{t(a.allActions, { count: formatNumber(total, locale) })}</option>
          {actions.map((entry) => (
            <option key={entry.action} value={entry.action}>
              {t(c.chipCount, {
                label: actionLabel(entry.action),
                count: formatNumber(entry._count.action, locale),
              })}
            </option>
          ))}
        </select>
        <button type="submit" className="z-btn z-btn--secondary z-btn--md">
          {c.filter}
        </button>
      </form>

      {logs.length === 0 ? (
        <EmptyState title={a.empty} body={a.emptyBody} />
      ) : (
        <>
          <div className="z-table--scroll">
            <table className="z-table">
              <thead>
                <tr>
                  <th>{c.date}</th>
                  <th>{a.who}</th>
                  <th>{a.action}</th>
                  <th>{a.target}</th>
                  <th>{a.details}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className="z-help">{formatDateTime(log.createdAt, locale)}</span>
                    </td>
                    <td>
                      {log.actor ? (
                        <>
                          {log.actor.firstName} {log.actor.lastName}
                          <br />
                          <span className="z-help" dir="ltr">
                            {log.actor.email}
                          </span>
                        </>
                      ) : (
                        <span className="z-help">
                          {log.actorEmail ? <bdi dir="ltr">{log.actorEmail}</bdi> : a.system}
                        </span>
                      )}
                    </td>
                    <td>
                      <span title={log.action}>
                        <Badge tone={SENSITIVE.has(log.action) ? 'warning' : 'neutral'}>
                          {actionLabel(log.action)}
                        </Badge>
                      </span>
                    </td>
                    <td>
                      <span className="z-help">
                        {log.targetType ? (a.targets[log.targetType] ?? log.targetType) : '—'}
                        {log.targetId ? (
                          <>
                            <br />
                            <bdi dir="ltr" title={log.targetId}>
                              {log.targetId.slice(0, 12)}…
                            </bdi>
                          </>
                        ) : null}
                      </span>
                    </td>
                    <td>
                      {log.metadata && Object.keys(log.metadata as object).length > 0 ? (
                        <code className="z-code" dir="ltr">
                          {JSON.stringify(log.metadata)}
                        </code>
                      ) : (
                        <span className="z-help">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 ? (
            <nav className="z-pagination" aria-label={c.pagination}>
              {page > 1 ? (
                <a className="z-btn z-btn--secondary z-btn--sm" href={pageHref(page - 1)}>
                  <Arrow to="back" /> {m.common.previous}
                </a>
              ) : null}
              <span className="z-pagination__state">
                {t(c.pageState, {
                  page: formatNumber(page, locale),
                  total: formatNumber(pageCount, locale),
                })}
              </span>
              {page < pageCount ? (
                <a className="z-btn z-btn--secondary z-btn--sm" href={pageHref(page + 1)}>
                  {m.common.next} <Arrow />
                </a>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
