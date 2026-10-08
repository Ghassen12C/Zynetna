'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { reviewD17PaymentAction } from '@/server/actions/payments';
import { idle } from '@/lib/formState';
import type { Messages } from '@/i18n';

function Submit({
  label,
  value,
  variant,
}: {
  label: string;
  value: 'confirm' | 'reject';
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" name="decision" value={value} variant={variant} loading={pending}>
      {label}
    </Button>
  );
}

/**
 * Admin: confirm a D17 payment once the money is seen in the D17 app, or
 * refuse it with a reason the professional receives. One per pending payment.
 */
export function D17Review({
  paymentId,
  m,
}: {
  paymentId: string;
  m: Pick<Messages, 'admin' | 'common'>;
}) {
  const d = m.admin.d17;
  const router = useRouter();
  const [state, formAction] = useActionState(reviewD17PaymentAction, idle);
  const [rejecting, setRejecting] = useState(false);
  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="z-stack" style={{ gap: 'var(--z-space-2)' }}>
      <input type="hidden" name="paymentId" value={paymentId} />
      {state.status === 'error' ? <span className="z-error">{state.message}</span> : null}
      {rejecting ? (
        <>
          <label className="z-label" htmlFor={`reason-${paymentId}`}>
            {d.rejectReason}
          </label>
          <textarea
            id={`reason-${paymentId}`}
            name="reason"
            className="z-input"
            rows={2}
            maxLength={300}
            required
            placeholder={d.rejectPlaceholder}
          />
          <div className="z-row" style={{ gap: 'var(--z-space-1)', flexWrap: 'wrap' }}>
            <Submit label={d.reject} value="reject" variant="secondary" />
            <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              {m.common.cancel}
            </Button>
          </div>
        </>
      ) : (
        <div className="z-row" style={{ gap: 'var(--z-space-1)', flexWrap: 'wrap' }}>
          <Submit label={d.confirm} value="confirm" />
          <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(true)}>
            {d.reject}
          </Button>
        </div>
      )}
    </form>
  );
}
