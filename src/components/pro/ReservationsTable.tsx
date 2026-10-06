'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { transitionReservationAction } from '@/server/actions/proReservations';
import { idle } from '@/lib/formState';
import { formatPrice } from '@/i18n/format';

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

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmé',
  COMPLETED: 'Terminé',
  CANCELLED_BY_CUSTOMER: 'Annulé (client)',
  CANCELLED_BY_BUSINESS: 'Annulé (vous)',
  RESCHEDULED: 'Reporté',
  NO_SHOW: 'Absence',
  EXPIRED: 'Expiré',
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

/** Which transitions the business may apply, mirroring the state machine. */
function actionsFor(status: string): { action: string; label: string; variant: 'primary' | 'secondary' | 'ghost' | 'danger' }[] {
  if (status === 'PENDING') {
    return [
      { action: 'confirm', label: 'Confirmer', variant: 'primary' },
      { action: 'cancel', label: 'Refuser', variant: 'ghost' },
    ];
  }
  if (status === 'CONFIRMED') {
    return [
      { action: 'complete', label: 'Terminé', variant: 'secondary' },
      { action: 'noShow', label: 'Absence', variant: 'ghost' },
      { action: 'cancel', label: 'Annuler', variant: 'ghost' },
    ];
  }
  return [];
}

function ActionButton({ label, variant }: { label: string; variant: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} loading={pending}>
      {label}
    </Button>
  );
}

function RowActions({ businessId, row }: { businessId: string; row: Row }) {
  const router = useRouter();
  const [state, formAction] = useActionState(transitionReservationAction, idle);
  if (state.status === 'success') router.refresh();

  const actions = actionsFor(row.status);
  if (actions.length === 0) return <span className="z-help">—</span>;

  return (
    <div className="z-row" style={{ gap: 'var(--z-space-1)', flexWrap: 'wrap' }}>
      {actions.map((item) => (
        <form key={item.action} action={formAction}>
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
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    startTransition(() => router.push(`/pro/dashboard/reservations?${next.toString()}`));
  }

  const pageCount = Math.ceil(total / perPage);
  const fmt = new Intl.DateTimeFormat('fr-TN', {
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
        <h2 className="z-profile__h3">Réservations ({total})</h2>
        <div className="z-row z-row--gap">
          <Link className="z-btn z-btn--primary z-btn--sm" href="/pro/dashboard/reservations/new">
            + Nouveau rendez-vous
          </Link>
          <Link href="/pro/dashboard/calendar">Vue agenda →</Link>
        </div>
      </div>

      {created ? (
        <Alert tone="success">
          Rendez-vous <strong>{created}</strong> enregistré. Il bloque désormais le créneau.
        </Alert>
      ) : null}

      <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
        <select
          className="z-select"
          style={{ width: 'auto' }}
          value={filters.status ?? ''}
          onChange={(e) => setParam('status', e.target.value || null)}
          aria-label="Filtrer par statut"
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
          value={filters.staff ?? ''}
          onChange={(e) => setParam('staff', e.target.value || null)}
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

      {rows.length === 0 ? (
        <EmptyState
          title="Aucune réservation"
          body="Les réservations apparaîtront ici dès qu’un client réserve en ligne."
        />
      ) : (
        <>
          <div className="z-table--scroll">
            <table className="z-table">
              <thead>
                <tr>
                  <th>Quand</th>
                  <th>Client</th>
                  <th>Prestation</th>
                  <th>Professionnel</th>
                  <th>Statut</th>
                  <th>Montant</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{fmt.format(new Date(row.startAt))}</strong>
                      <br />
                      <span className="z-help">{row.reference}</span>
                    </td>
                    <td>
                      {row.customerName}
                      {row.customerPhone ? (
                        <>
                          <br />
                          <a href={`tel:${row.customerPhone}`} className="z-help">
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
                          >
                            {expanded === row.id ? 'Masquer la note' : 'Note du client'}
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
                        {STATUS_LABEL[row.status] ?? row.status}
                      </Badge>
                    </td>
                    <td>{formatPrice(row.amount, 'fr', currency)}</td>
                    <td>
                      <RowActions businessId={businessId} row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 ? (
            <nav className="z-pagination" aria-label="Pagination">
              {page > 1 ? (
                <button
                  type="button"
                  className="z-btn z-btn--secondary z-btn--sm"
                  onClick={() => setParam('page', String(page - 1))}
                >
                  ← Précédent
                </button>
              ) : null}
              <span className="z-pagination__state">
                Page {page} sur {pageCount}
              </span>
              {page < pageCount ? (
                <button
                  type="button"
                  className="z-btn z-btn--secondary z-btn--sm"
                  onClick={() => setParam('page', String(page + 1))}
                >
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
