'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { requestPasswordResetAction } from '@/server/actions/auth';
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

export function ForgotPasswordForm({ m }: { m: Messages['auth'] }) {
  const [state, formAction] = useActionState(requestPasswordResetAction, idle);

  // The success message is deliberately the same whether or not the address
  // exists, so the form cannot be used to discover registered emails.
  if (state.status === 'success') {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <form action={formAction} className="z-auth__form" noValidate>
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}
      <Input
        label={m.email}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        error={state.status === 'error' ? state.fieldErrors?.email : null}
      />
      <Submit label={m.sendLink} />
    </form>
  );
}
