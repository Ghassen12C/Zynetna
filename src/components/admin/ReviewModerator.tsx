'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { moderateReviewAction } from '@/server/actions/admin';
import { idle } from '@/lib/formState';
import type { Messages } from '@/i18n';

type AdminMessages = Pick<Messages, 'admin' | 'labels' | 'common'>;

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
  m,
}: {
  reviewId: string;
  currentStatus: string;
  m: AdminMessages;
}) {
  const r = m.admin.reviews;
  const router = useRouter();
  const [state, formAction] = useActionState(moderateReviewAction, idle);
  const [pendingDecision, setPendingDecision] = useState<string | null>(null);
  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

  const decisions = [
    { key: 'publish', label: r.publish, variant: 'primary' as const, note: false },
    { key: 'hide', label: r.hide, variant: 'ghost' as const, note: true },
    { key: 'remove', label: r.remove, variant: 'ghost' as const, note: true },
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
          placeholder={r.notePlaceholder}
          aria-label={m.admin.common.reason}
        />
        <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
          <Submit label={m.common.confirm} variant="danger" />
          <Button type="button" variant="ghost" size="sm" onClick={() => setPendingDecision(null)}>
            {m.common.cancel}
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
