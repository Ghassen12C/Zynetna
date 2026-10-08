'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { cancelLoginChallengeAction, verifyLoginAction } from '@/server/actions/auth';
import { idle } from '@/lib/formState';
import type { Messages } from '@/i18n';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block loading={pending}>
      {label}
    </Button>
  );
}

export function VerifyForm({ m }: { m: Messages['auth'] }) {
  const [state, formAction] = useActionState(verifyLoginAction, idle);
  const [recovery, setRecovery] = useState(false);

  return (
    <div className="z-auth__form">
      <form action={formAction} className="z-auth__form" noValidate>
        {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

        {recovery ? (
          <Input
            key="recovery"
            label={m.recoveryLabel}
            name="code"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            dir="ltr"
            hint={m.recoveryHint}
          />
        ) : (
          <Input
            key="app"
            label={m.verifyCodeLabel}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            required
            autoFocus
            dir="ltr"
            className="z-otp"
          />
        )}

        <Submit label={m.verifySubmit} />
      </form>

      <p className="z-auth__foot">
        <button type="button" className="z-linkbtn" onClick={() => setRecovery((r) => !r)}>
          {recovery ? m.useApp : m.useRecovery}
        </button>
      </p>

      <form action={cancelLoginChallengeAction}>
        <p className="z-auth__foot">
          <button type="submit" className="z-linkbtn">
            {m.verifyCancel}
          </button>
        </p>
      </form>
    </div>
  );
}
