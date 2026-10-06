'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { moderateUserAction } from '@/server/actions/admin';
import { idle } from '@/lib/formState';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { formatDate, formatPhone } from '@/i18n/format';

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

const ROLE_LABEL: Record<string, string> = {
  CUSTOMER: 'Client',
  BUSINESS_OWNER: 'Propriétaire',
  BUSINESS_EMPLOYEE: 'Employé',
  SUPER_ADMIN: 'Admin',
};

function Submit({ label, variant }: { label: string; variant: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} loading={pending}>
      {label}
    </Button>
  );
}

function UserActions({ row, isSelf }: { row: Row; isSelf: boolean }) {
  const router = useRouter();
  const [state, formAction] = useActionState(moderateUserAction, idle);
  const [confirming, setConfirming] = useState(false);
  if (state.status === 'success') router.refresh();

  // An admin cannot act on their own account from this table.
  if (isSelf) return <span className="z-help">Vous</span>;

  const isAdmin = row.roles.includes('SUPER_ADMIN');

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-2)' }}>
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

      {confirming ? (
        <form action={formAction} className="z-stack" style={{ gap: 'var(--z-space-2)' }}>
          <input type="hidden" name="userId" value={row.id} />
          <input type="hidden" name="decision" value="suspend" />
          <textarea name="note" className="z-textarea" rows={2} placeholder="Motif (interne)" aria-label="Motif" />
          <div className="z-row" style={{ gap: 'var(--z-space-2)' }}>
            <Submit label="Suspendre" variant="danger" />
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Annuler
            </Button>
          </div>
        </form>
      ) : (
        <div className="z-row" style={{ gap: 'var(--z-space-1)', flexWrap: 'wrap' }}>
          {row.status === 'ACTIVE' ? (
            <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
              Suspendre
            </Button>
          ) : (
            <form action={formAction}>
              <input type="hidden" name="userId" value={row.id} />
              <input type="hidden" name="decision" value="reactivate" />
              <Submit label="Réactiver" variant="primary" />
            </form>
          )}

          <form action={formAction}>
            <input type="hidden" name="userId" value={row.id} />
            <input type="hidden" name="decision" value={isAdmin ? 'revokeAdmin' : 'grantAdmin'} />
            <Submit label={isAdmin ? 'Retirer admin' : 'Nommer admin'} variant="secondary" />
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
}: {
  currentUserId: string;
  rows: Row[];
  total: number;
  page: number;
  pageCount: number;
  filters: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q ?? '');

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    startTransition(() => router.push(`/admin/users?${next.toString()}`));
  }

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-5)' }}>
      <h1 className="z-search__title">Utilisateurs ({total})</h1>

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
          placeholder="Nom, e-mail ou téléphone"
          aria-label="Rechercher"
        />
        <Button type="submit" variant="secondary">
          Rechercher
        </Button>

        <select
          className="z-select"
          style={{ width: 'auto' }}
          value={filters.role ?? ''}
          onChange={(e) => setParam('role', e.target.value || null)}
          aria-label="Rôle"
        >
          <option value="">Tous les rôles</option>
          {Object.entries(ROLE_LABEL).map(([value, label]) => (
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
          aria-label="Statut"
        >
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actif</option>
          <option value="SUSPENDED">Suspendu</option>
        </select>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="Aucun utilisateur" body="Aucun résultat pour ces filtres." />
      ) : (
        <>
          <div className="z-table--scroll">
            <table className="z-table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Rôles</th>
                  <th>Statut</th>
                  <th>Activité</th>
                  <th>Dernière connexion</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      <br />
                      <span className="z-help">{row.email}</span>
                      {row.phone ? (
                        <>
                          <br />
                          <span className="z-help">{formatPhone(row.phone)}</span>
                        </>
                      ) : null}
                    </td>
                    <td>
                      <div className="z-row" style={{ gap: 4, flexWrap: 'wrap' }}>
                        {row.roles.map((role) => (
                          <Badge key={role} tone={role === 'SUPER_ADMIN' ? 'gold' : 'neutral'}>
                            {ROLE_LABEL[role] ?? role}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td>
                      <Badge tone={row.status === 'ACTIVE' ? 'success' : 'danger'}>
                        {row.status === 'ACTIVE' ? 'Actif' : 'Suspendu'}
                      </Badge>
                    </td>
                    <td>
                      <span className="z-help">
                        {row.reservations} RDV · {row.reviews} avis
                        <br />
                        inscrit le {formatDate(new Date(row.createdAt))}
                      </span>
                    </td>
                    <td>
                      <span className="z-help">
                        <RelativeTime value={row.lastLoginAt} fallback="jamais" />
                      </span>
                    </td>
                    <td>
                      <UserActions row={row} isSelf={row.id === currentUserId} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 ? (
            <nav className="z-pagination" aria-label="Pagination">
              {page > 1 ? (
                <button type="button" className="z-btn z-btn--secondary z-btn--sm" onClick={() => setParam('page', String(page - 1))}>
                  ← Précédent
                </button>
              ) : null}
              <span className="z-pagination__state">
                Page {page} sur {pageCount}
              </span>
              {page < pageCount ? (
                <button type="button" className="z-btn z-btn--secondary z-btn--sm" onClick={() => setParam('page', String(page + 1))}>
                  Suivant →
                </button>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
