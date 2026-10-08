'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { respondToReviewAction } from '@/server/actions/reviews';
import { idle } from '@/lib/formState';
import type { Messages } from '@/i18n';

type Dict = { reviews: Messages['dash']['reviews']; common: Messages['common'] };

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      {label}
    </Button>
  );
}

export function ReviewResponder({
  m,
  reviewId,
  existing,
}: {
  m: Dict;
  reviewId: string;
  existing: string | null;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(respondToReviewAction, idle);
  const [open, setOpen] = useState(false);
  const d = m.reviews;

  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

  if (existing && !open) {
    return (
      <div className="z-review__response">
        <strong>{d.yourResponse}</strong>
        <p>{existing}</p>
        <button type="button" className="z-linkbtn" onClick={() => setOpen(true)}>
          {m.common.edit}
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {d.respond}
      </Button>
    );
  }

  return (
    <form action={formAction} className="z-stack" style={{ gap: 'var(--z-space-2)' }}>
      <input type="hidden" name="reviewId" value={reviewId} />
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}
      <textarea
        name="body"
        className="z-textarea"
        defaultValue={existing ?? ''}
        maxLength={1000}
        required
        placeholder={d.placeholder}
        aria-label={d.yourResponse}
      />
      <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
        <Submit label={d.publish} />
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          {m.common.cancel}
        </Button>
      </div>
    </form>
  );
}
