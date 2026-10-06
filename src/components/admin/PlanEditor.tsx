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
import { formatPrice } from '@/i18n/format';

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

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Enregistrer
    </Button>
  );
}

/**
 * Plans are data. The launch offer — 2 months free then 30 TND — is a row
 * edited here, never a constant in the codebase, so changing the price or the
 * trial length is an admin action rather than a deployment.
 */
export function PlanEditor({ plans }: { plans: Plan[] }) {
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
          <h2 className="z-profile__h3">Formules</h2>
          <p className="z-policy">
            Le prix et la durée d’essai sont des données, pas du code — vos changements
            s’appliquent aux nouveaux abonnements sans redéploiement.
          </p>
        </div>
        {!creating && !editing ? (
          <Button size="sm" onClick={() => setCreating(true)}>
            + Formule
          </Button>
        ) : null}
      </div>

      {creating || editing ? (
        <form action={formAction} className="z-auth__form">
          {target ? <input type="hidden" name="id" value={target.id} /> : null}
          {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

          <div className="z-auth__row">
            <Input label="Nom" name="name" defaultValue={target?.name ?? ''} required error={errors?.name} />
            <Input label="Code" name="code" defaultValue={target?.code ?? ''} required hint="minuscules-et-tirets" error={errors?.code} />
          </div>

          <Textarea label="Description" name="description" defaultValue={target?.description ?? ''} optional />

          <div className="z-auth__row">
            <Input
              label="Prix"
              name="priceAmount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={target?.priceAmount ?? 30}
              required
              error={errors?.priceAmount}
            />
            <Input label="Devise" name="currency" defaultValue={target?.currency ?? 'TND'} maxLength={3} required />
          </div>

          <div className="z-auth__row">
            <Select label="Périodicité" name="interval" defaultValue={target?.interval ?? 'MONTH'}>
              <option value="MONTH">Mensuelle</option>
              <option value="YEAR">Annuelle</option>
            </Select>
            <Input
              label="Jours d’essai"
              name="trialDays"
              type="number"
              min="0"
              defaultValue={target?.trialDays ?? 60}
              required
              hint="60 = deux mois offerts."
            />
          </div>

          <Input
            label="Période de grâce (jours)"
            name="gracePeriodDays"
            type="number"
            min="0"
            defaultValue={target?.gracePeriodDays ?? 7}
            required
            hint="Délai après échéance avant la coupure."
          />

          <label className="z-check">
            <input type="checkbox" name="isActive" defaultChecked={target?.isActive ?? true} />
            <span>Formule proposée</span>
          </label>

          <div className="z-row" style={{ gap: 'var(--z-space-2)' }}>
            <Submit />
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
            >
              Annuler
            </Button>
          </div>
        </form>
      ) : null}

      <div className="z-grid z-grid--2">
        {plans.map((plan) => (
          <div key={plan.id} className={`z-plan ${plan.isDefault ? 'is-current' : ''}`}>
            <h3>
              {plan.name}{' '}
              {plan.isDefault ? <Badge tone="accent">Par défaut</Badge> : null}
              {!plan.isActive ? <Badge tone="neutral">Inactive</Badge> : null}
            </h3>
            <p className="z-plan__price">
              {formatPrice(plan.priceAmount, 'fr', plan.currency)}
              <span> / {plan.interval === 'MONTH' ? 'mois' : 'an'}</span>
            </p>
            <p className="z-help">
              {plan.code} · {plan.trialDays} jours d’essai · {plan.gracePeriodDays} jours de grâce
            </p>
            <Button size="sm" variant="secondary" onClick={() => setEditing(plan)}>
              Modifier
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}
