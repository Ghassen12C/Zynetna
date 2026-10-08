'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { recordPaymentAction } from '@/server/actions/admin';
import { idle } from '@/lib/formState';
import type { Messages } from '@/i18n';
import { interpolate } from '@/i18n/interpolate';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      {label}
    </Button>
  );
}

/**
 * Manual payment capture.
 *
 * Online payment is not open yet; this records a real bank or cash payment the
 * platform owner has received, and advances the subscription accordingly. It
 * is deliberately not a fake card form.
 */
export function RecordPaymentForm({
  businessId,
  defaultAmount,
  currency,
  m,
}: {
  businessId: string;
  defaultAmount: number;
  currency: string;
  m: Pick<Messages, 'admin' | 'common'>;
}) {
  const p = m.admin.payment;
  const router = useRouter();
  const [state, formAction] = useActionState(recordPaymentAction, idle);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {p.open}
      </Button>
    );
  }

  return (
    <form action={formAction} className="z-stack" style={{ gap: 'var(--z-space-2)' }}>
      <input type="hidden" name="businessId" value={businessId} />
      <input
        type="number"
        name="amount"
        className="z-input"
        step="0.01"
        min="0"
        defaultValue={defaultAmount}
        required
        aria-label={interpolate(p.amount, { currency })}
        dir="ltr"
        style={{ minHeight: 36, padding: '6px 10px' }}
      />
      <input
        type="text"
        name="providerRef"
        className="z-input"
        placeholder={p.referencePlaceholder}
        aria-label={p.reference}
        style={{ minHeight: 36, padding: '6px 10px' }}
      />
      {state.status === 'error' ? <span className="z-error">{state.message}</span> : null}
      <div className="z-row" style={{ gap: 'var(--z-space-1)' }}>
        <Submit label={m.common.save} />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
          aria-label={p.close}
          title={p.close}
        >
          ×
        </Button>
      </div>
    </form>
  );
}
