import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { requireSuperAdmin } from '@/server/auth/guard';
import { formatDateTime } from '@/i18n/format';

export const metadata: Metadata = { title: 'Journal d’audit', robots: { index: false } };

const ACTION_LABEL: Record<string, string> = {
  'auth.login': 'Connexion',
  'auth.logout': 'Déconnexion',
  'auth.password_changed': 'Mot de passe changé',
  'business.created': 'Établissement créé',
  'business.updated': 'Établissement modifié',
  'business.published': 'Établissement publié',
  'business.approved': 'Établissement approuvé',
  'business.rejected': 'Établissement refusé',
  'business.verified': 'Vérification modifiée',
  'business.suspended': 'Établissement suspendu',
  'business.reactivated': 'Établissement réactivé',
  'user.suspended': 'Utilisateur suspendu',
  'user.reactivated': 'Utilisateur réactivé',
  'user.role_granted': 'Rôle accordé',
  'user.role_revoked': 'Rôle retiré',
  'reservation.created': 'Réservation créée',
  'reservation.confirmed': 'Réservation confirmée',
  'reservation.cancelled': 'Réservation annulée',
  'reservation.completed': 'Réservation terminée',
  'reservation.no_show': 'Absence enregistrée',
  'review.moderated': 'Avis modéré',
  'report.resolved': 'Signalement traité',
  'category.created': 'Catégorie créée',
  'category.updated': 'Catégorie modifiée',
  'payment.recorded': 'Paiement enregistré',
  'setting.updated': 'Réglage modifié',
  'flag.updated': 'Fonctionnalité modifiée',
  'subscription.plan_updated': 'Formule modifiée',
  'media.deleted': 'Image supprimée',
};

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

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-5)' }}>
      <div>
        <h1 className="z-search__title">Journal d’audit ({total})</h1>
        <p className="z-policy">
          Qui a fait quoi, quand, et sur quel objet. Les écritures sont définitives.
        </p>
      </div>

      <form className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
        <select
          className="z-select"
          style={{ width: 'auto' }}
          name="action"
          defaultValue={params.action ?? ''}
          aria-label="Filtrer par action"
        >
          <option value="">Toutes les actions ({total})</option>
          {actions.map((a) => (
            <option key={a.action} value={a.action}>
              {ACTION_LABEL[a.action] ?? a.action} ({a._count.action})
            </option>
          ))}
        </select>
        <button type="submit" className="z-btn z-btn--secondary z-btn--md">
          Filtrer
        </button>
      </form>

      {logs.length === 0 ? (
        <EmptyState title="Journal vide" body="Aucune action enregistrée pour ce filtre." />
      ) : (
        <>
          <div className="z-table--scroll">
            <table className="z-table">
              <thead>
                <tr>
                  <th>Quand</th>
                  <th>Qui</th>
                  <th>Action</th>
                  <th>Objet</th>
                  <th>Détails</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className="z-help">{formatDateTime(log.createdAt)}</span>
                    </td>
                    <td>
                      {log.actor ? (
                        <>
                          {log.actor.firstName} {log.actor.lastName}
                          <br />
                          <span className="z-help">{log.actor.email}</span>
                        </>
                      ) : (
                        <span className="z-help">{log.actorEmail ?? 'système'}</span>
                      )}
                    </td>
                    <td>
                      <Badge tone={SENSITIVE.has(log.action) ? 'warning' : 'neutral'}>
                        {ACTION_LABEL[log.action] ?? log.action}
                      </Badge>
                    </td>
                    <td>
                      <span className="z-help">
                        {log.targetType}
                        {log.targetId ? (
                          <>
                            <br />
                            {log.targetId.slice(0, 12)}…
                          </>
                        ) : null}
                      </span>
                    </td>
                    <td>
                      {log.metadata && Object.keys(log.metadata as object).length > 0 ? (
                        <code className="z-code">{JSON.stringify(log.metadata)}</code>
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
            <nav className="z-pagination" aria-label="Pagination">
              {page > 1 ? (
                <a
                  className="z-btn z-btn--secondary z-btn--sm"
                  href={`/admin/audit?page=${page - 1}${params.action ? `&action=${params.action}` : ''}`}
                >
                  ← Précédent
                </a>
              ) : null}
              <span className="z-pagination__state">
                Page {page} sur {pageCount}
              </span>
              {page < pageCount ? (
                <a
                  className="z-btn z-btn--secondary z-btn--sm"
                  href={`/admin/audit?page=${page + 1}${params.action ? `&action=${params.action}` : ''}`}
                >
                  Suivant →
                </a>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
