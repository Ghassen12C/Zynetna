'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { moderateReviewAction } from '@/server/actions/admin';
import { idle } from '@/lib/formState';

function Submit({ label, variant }: { label: string; variant: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} loading={pending}>
      {label}
    </Button>
  );
}

export function ReviewModerator({
  reviewId,
  currentStatus,
}: {
  reviewId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(moderateReviewAction, idle);
  const [pendingDecision, setPendingDecision] = useState<string | null>(null);
  if (state.status === 'success') router.refresh();

  const decisions = [
    { key: 'publish', label: 'Publier', variant: 'primary' as const, note: false },
    { key: 'hide', label: 'Masquer', variant: 'ghost' as const, note: true },
    { key: 'remove', label: 'Supprimer', variant: 'ghost' as const, note: true },
  ].filter((d) => {
    if (d.key === 'publish') return currentStatus !== 'PUBLISHED';
    if (d.key === 'hide') return currentStatus !== 'HIDDEN';
    return currentStatus !== 'REMOVED';
  });

  if (pendingDecision) {
    return (
      <form action={formAction} className="z-stack" style={{ gap: 'var(--z-space-2)' }}>
        <input type="hidden" name="reviewId" value={reviewId} />
        <input type="hidden" name="decision" value={pendingDecision} />
        <textarea
          name="note"
          className="z-textarea"
          rows={2}
          placeholder="Motif de modération (interne)"
          aria-label="Motif"
        />
        <div className="z-row" style={{ gap: 'var(--z-space-2)' }}>
          <Submit label="Confirmer" variant="danger" />
          <Button type="button" variant="ghost" size="sm" onClick={() => setPendingDecision(null)}>
            Annuler
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-2)' }}>
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}
      <div className="z-row" style={{ gap: 'var(--z-space-1)', flexWrap: 'wrap' }}>
        {decisions.map((decision) =>
          decision.note ? (
            <Button
              key={decision.key}
              size="sm"
              variant={decision.variant}
              onClick={() => setPendingDecision(decision.key)}
            >
              {decision.label}
            </Button>
          ) : (
            <form key={decision.key} action={formAction}>
              <input type="hidden" name="reviewId" value={reviewId} />
              <input type="hidden" name="decision" value={decision.key} />
              <Submit label={decision.label} variant={decision.variant} />
            </form>
          ),
        )}
      </div>
    </div>
  );
}
