'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { submitD17PaymentAction } from '@/server/actions/payments';
import { idle } from '@/lib/formState';
import { interpolate } from '@/i18n/interpolate';
import type { Messages } from '@/i18n';

type Plan = { id: string; name: string; price: string; interval: string };

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" loading={pending}>
      {label}
    </Button>
  );
}

/**
 * Pro: pay the subscription by D17. The business scans the platform's QR in
 * its own D17 app, then sends the screenshot; nothing is charged here, and the
 * subscription only moves once an admin has confirmed the money arrived.
 */
export function D17PayForm({
  businessId,
  plans,
  currentPlanId,
  reference,
  holder,
  phone,
  qrVersion,
  m,
}: {
  businessId: string;
  plans: Plan[];
  currentPlanId: string;
  reference: string;
  holder: string;
  phone: string;
  qrVersion: string;
  m: Pick<Messages, 'dash'>;
}) {
  const d = m.dash.subscription;
  const router = useRouter();
  const [state, formAction] = useActionState(submitD17PaymentAction, idle);
  const [planId, setPlanId] = useState(
    plans.some((p) => p.id === currentPlanId) ? currentPlanId : (plans[0]?.id ?? ''),
  );
  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

  const plan = plans.find((p) => p.id === planId);
  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="z-auth__form">
      <input type="hidden" name="businessId" value={businessId} />
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

      <fieldset className="z-stack" style={{ gap: 'var(--z-space-3)' }}>
        <legend className="z-label">{d.d17Step1}</legend>
        <div className="z-choices">
          {plans.map((p) => (
            <label key={p.id} className={`z-choice ${planId === p.id ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="planId"
                value={p.id}
                checked={planId === p.id}
                onChange={() => setPlanId(p.id)}
                className="z-sr-only"
              />
              <span className="z-choice__body">
                <span className="z-choice__title" dir="auto">
                  {p.name}
                </span>
                <span className="z-choice__meta">{p.interval}</span>
              </span>
              <span className="z-choice__price">{p.price}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="z-stack" style={{ gap: 'var(--z-space-3)' }}>
        <p className="z-label">{interpolate(d.d17Step2, { amount: plan?.price ?? '' })}</p>
        <div className="z-d17__setup">
          <figure className="z-d17__qr">
            {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-gated route */}
            <img src={`/api/payments/d17-qr?v=${qrVersion}`} alt={d.d17Title} width={220} />
          </figure>
          <dl className="z-kv">
            {holder ? (
              <div>
                <dt>{d.d17Holder}</dt>
                <dd dir="auto">{holder}</dd>
              </div>
            ) : null}
            {phone ? (
              <div>
                <dt>{d.d17Phone}</dt>
                <dd>
                  <bdi dir="ltr">{phone}</bdi>
                </dd>
              </div>
            ) : null}
            <div>
              <dt>{d.d17Note}</dt>
              <dd>
                <bdi dir="ltr" className="z-d17__ref">
                  {reference}
                </bdi>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="z-stack" style={{ gap: 'var(--z-space-3)' }}>
        <p className="z-label">{d.d17Step3}</p>
        <div className="z-field">
          <label className="z-label" htmlFor="d17-proof">
            {d.d17Proof}
          </label>
          <input
            id="d17-proof"
            type="file"
            name="proof"
            accept="image/jpeg,image/png,image/webp"
            className="z-input"
            required
            aria-describedby="d17-proof-hint"
          />
          <span className="z-help" id="d17-proof-hint">
            {d.d17ProofHint}
          </span>
        </div>
        <Input
          label={d.d17TransactionRef}
          name="transactionRef"
          maxLength={60}
          dir="ltr"
          optional
          error={errors?.transactionRef}
        />
      </div>

      <div>
        <Submit label={d.d17Submit} />
      </div>
    </form>
  );
}
