'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { idle } from '@/lib/formState';
import { acceptInvitationAction } from '@/server/actions/invitations';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" loading={pending}>
      {label}
    </Button>
  );
}

/**
 * Accepting is a single submit. On success the action redirects from the
 * server, so there is no client-side navigation to race against the page
 * re-rendering itself as "already accepted".
 */
export function AcceptInvitation({
  token,
  submitLabel,
}: {
  token: string;
  /** "Join {business}", already in the reader's language. */
  submitLabel: string;
}) {
  const [state, action] = useActionState(acceptInvitationAction, idle);

  return (
    <form action={action} className="z-stack" style={{ gap: 'var(--z-space-3)' }}>
      <input type="hidden" name="token" value={token} />
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}
      <Submit label={submitLabel} />
    </form>
  );
}
