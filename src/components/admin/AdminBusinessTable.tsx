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
import { formatDate } from '@/i18n/format';

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

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon',
  PENDING_REVIEW: 'À valider',
  ACTIVE: 'En ligne',
  SUSPENDED: 'Suspendu',
  REJECTED: 'Refusé',
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
function Moderate({ row }: { row: Row }) {
  const router = useRouter();
  const [state, formAction] = useActionState(moderateBusinessAction, idle);
  const [needsNote, setNeedsNote] = useState<string | null>(null);

  if (state.status === 'success') router.refresh();

  const decisions: { key: string; label: string; variant: 'primary' | 'secondary' | 'ghost' | 'danger'; note?: boolean }[] = [];
  if (row.status === 'PENDING_REVIEW' || row.status === 'DRAFT') {
    decisions.push({ key: 'approve', label: 'Approuver', variant: 'primary' });
    decisions.push({ key: 'reject', label: 'Refuser', variant: 'ghost', note: true });
  }
  if (row.status === 'ACTIVE') {
    decisions.push(
      row.verification === 'VERIFIED'
        ? { key: 'unverify', label: 'Retirer le badge', variant: 'ghost' }
        : { key: 'verify', label: 'Vérifier', variant: 'secondary' },
    );
    decisions.push({ key: 'suspend', label: 'Suspendre', variant: 'ghost', note: true });
  }
  if (row.status === 'SUSPENDED' || row.status === 'REJECTED') {
    decisions.push({ key: 'reactivate', label: 'Réactiver', variant: 'primary' });
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
            placeholder="Motif communiqué au propriétaire…"
            aria-label="Motif"
          />
          <div className="z-row" style={{ gap: 'var(--z-space-2)' }}>
            <ModerateButton label="Confirmer" variant="danger" />
            <Button type="button" variant="ghost" size="sm" onClick={() => setNeedsNote(null)}>
              Annuler
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
}: {
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
    startTransition(() => router.push(`/admin/businesses?${next.toString()}`));
  }

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-5)' }}>
      <h1 className="z-search__title">Établissements ({total})</h1>

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
          placeholder="Nom, slug ou e-mail du propriétaire"
          aria-label="Rechercher"
        />
        <Button type="submit" variant="secondary">
          Rechercher
        </Button>

        <select
          className="z-select"
          style={{ width: 'auto' }}
          value={filters.status ?? ''}
          onChange={(e) => setParam('status', e.target.value || null)}
          aria-label="Statut"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
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
          aria-label="Vérification"
        >
          <option value="">Toutes vérifications</option>
          <option value="VERIFIED">Vérifié</option>
          <option value="PENDING">En attente</option>
          <option value="UNVERIFIED">Non vérifié</option>
          <option value="REJECTED">Refusé</option>
        </select>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="Aucun établissement" body="Aucun résultat pour ces filtres." />
      ) : (
        <>
          <div className="z-table--scroll">
            <table className="z-table">
              <thead>
                <tr>
                  <th>Établissement</th>
                  <th>Propriétaire</th>
                  <th>Statut</th>
                  <th>Abonnement</th>
                  <th>Activité</th>
                  <th>Modération</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/business/${row.slug}`} className="z-ranklist__name">
                        {row.name}
                      </Link>
                      <br />
                      <span className="z-help">
                        {row.cityName ?? '—'} · créé le {formatDate(new Date(row.createdAt))}
                      </span>
                    </td>
                    <td>
                      {row.ownerName}
                      <br />
                      <span className="z-help">{row.ownerEmail}</span>
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </Badge>
                      {row.verification === 'VERIFIED' ? (
                        <>
                          <br />
                          <Badge tone="accent">✓ Vérifié</Badge>
                        </>
                      ) : null}
                    </td>
                    <td>
                      <span className="z-help">{row.subscriptionStatus ?? '—'}</span>
                    </td>
                    <td>
                      <span className="z-help">
                        {row.reservations} RDV · {row.services} prestations · {row.staff} équipe
                        <br />
                        {row.ratingCount > 0
                          ? `${row.ratingAverage.toFixed(1)}★ (${row.ratingCount})`
                          : 'pas d’avis'}
                      </span>
                    </td>
                    <td>
                      <Moderate row={row} />
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
