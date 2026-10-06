'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { respondToReviewAction } from '@/server/actions/reviews';
import { idle } from '@/lib/formState';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      Publier la réponse
    </Button>
  );
}

export function ReviewResponder({
  reviewId,
  existing,
}: {
  reviewId: string;
  existing: string | null;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(respondToReviewAction, idle);
  const [open, setOpen] = useState(false);

  if (state.status === 'success') {
    router.refresh();
  }

  if (existing && !open) {
    return (
      <div className="z-review__response">
        <strong>Votre réponse</strong>
        <p>{existing}</p>
        <button type="button" className="z-linkbtn" onClick={() => setOpen(true)}>
          Modifier
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Répondre
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
        placeholder="Merci pour votre retour…"
        aria-label="Votre réponse"
      />
      <div className="z-row" style={{ gap: 'var(--z-space-2)' }}>
        <Submit />
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
