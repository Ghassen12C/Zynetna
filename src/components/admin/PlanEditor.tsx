'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Badge, Panel } from '@/components/ui/Primitives';
import { savePlanAction } from '@/server/actions/admin';
import { idle } from '@/lib/formState';
import type { Messages } from '@/i18n';
import { interpolate } from '@/i18n/interpolate';
import type { Locale } from '@/i18n/config';
import { formatCount, formatPrice } from '@/i18n/format';

type AdminMessages = Pick<Messages, 'admin' | 'labels' | 'common'>;

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceAmount: number;
  currency: string;
  interval: string;
  trialDays: number;
  gracePeriodDays: number;
  isActive: boolean;
  isDefault: boolean;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

/**
 * Plans are data. The launch offer — 2 months free then 30 TND — is a row
 * edited here, never a constant in the codebase, so changing the price or the
 * trial length is an admin action rather than a deployment.
 */
export function PlanEditor({
  plans,
  m,
  locale,
}: {
  plans: Plan[];
  m: AdminMessages;
  locale: Locale;
}) {
  const p = m.admin.plans;
  const days = (n: number) => formatCount(m.admin.common.daysCount, n, locale);
  const router = useRouter();
  const [state, formAction] = useActionState(savePlanAction, idle);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);

  if (state.status === 'success') {
    router.refresh();
    if (editing) setEditing(null);
    if (creating) setCreating(false);
  }

  const target = editing ?? null;
  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <Panel className="z-dash__panel">
      <div className="z-dash__panel-head">
        <div>
          <h2 className="z-profile__h3">{p.title}</h2>
          <p className="z-policy">{p.lead}</p>
        </div>
        {!creating && !editing ? (
          <Button size="sm" onClick={() => setCreating(true)}>
            {p.create}
          </Button>
        ) : null}
      </div>

      {creating || editing ? (
        <form action={formAction} className="z-auth__form">
          {target ? <input type="hidden" name="id" value={target.id} /> : null}
          {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

          <div className="z-auth__row">
            <Input
              label={p.name}
              name="name"
              defaultValue={target?.name ?? ''}
              required
              error={errors?.name}
            />
            <Input
              label={p.code}
              name="code"
              defaultValue={target?.code ?? ''}
              required
              dir="ltr"
              hint={p.codeHint}
              error={errors?.code}
            />
          </div>

          <Textarea
            label={p.description}
            name="description"
            defaultValue={target?.description ?? ''}
            optional
          />

          <div className="z-auth__row">
            <Input
              label={p.price}
              name="priceAmount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={target?.priceAmount ?? 30}
              required
              error={errors?.priceAmount}
            />
            <Input
              label={p.currency}
              name="currency"
              defaultValue={target?.currency ?? 'TND'}
              maxLength={3}
              dir="ltr"
              required
            />
          </div>

          <div className="z-auth__row">
            <Select label={p.interval} name="interval" defaultValue={target?.interval ?? 'MONTH'}>
              <option value="MONTH">{p.monthly}</option>
              <option value="YEAR">{p.yearly}</option>
            </Select>
            <Input
              label={p.trialDays}
              name="trialDays"
              type="number"
              min="0"
              defaultValue={target?.trialDays ?? 60}
              required
              hint={p.trialHint}
            />
          </div>

          <Input
            label={p.graceDays}
            name="gracePeriodDays"
            type="number"
            min="0"
            defaultValue={target?.gracePeriodDays ?? 7}
            required
            hint={p.graceHint}
          />

          <label className="z-check">
            <input type="checkbox" name="isActive" defaultChecked={target?.isActive ?? true} />
            <span>{p.offered}</span>
          </label>

          <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
            <Submit label={m.common.save} />
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
            >
              {m.common.cancel}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="z-grid z-grid--2">
        {plans.map((plan) => (
          <div key={plan.id} className={`z-plan ${plan.isDefault ? 'is-current' : ''}`}>
            <h3>
              {plan.name}{' '}
              {plan.isDefault ? <Badge tone="accent">{p.isDefault}</Badge> : null}
              {!plan.isActive ? <Badge tone="neutral">{p.inactive}</Badge> : null}
            </h3>
            <p className="z-plan__price">
              {formatPrice(plan.priceAmount, locale, plan.currency)}
              <span>
                {' / '}
                {m.labels.interval[plan.interval as keyof typeof m.labels.interval] ??
                  plan.interval}
              </span>
            </p>
            <p className="z-help">
              <bdi dir="ltr">{plan.code}</bdi> ·{' '}
              {interpolate(p.trial, { days: days(plan.trialDays) })} ·{' '}
              {interpolate(p.grace, { days: days(plan.gracePeriodDays) })}
            </p>
            <Button size="sm" variant="secondary" onClick={() => setEditing(plan)}>
              {m.common.edit}
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}
