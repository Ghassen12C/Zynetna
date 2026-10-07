'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { changePasswordAction } from '@/server/actions/auth';
import { idle } from '@/lib/formState';
import { MIN_PASSWORD_LENGTH } from '@/domain/identity/password';
import { interpolate } from '@/i18n/interpolate';
import type { Messages } from '@/i18n';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" loading={pending}>
      {label}
    </Button>
  );
}

export function PasswordForm({
  m,
}: {
  m: { auth: Messages['auth']; account: Messages['account'] };
}) {
  const [state, formAction] = useActionState(changePasswordAction, idle);
  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="z-auth__form">
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}
      {state.status === 'success' ? <Alert tone="success">{state.message}</Alert> : null}

      <Input
        label={m.account.currentPassword}
        name="current"
        type="password"
        autoComplete="current-password"
        required
        error={errors?.current}
      />
      <Input
        label={m.auth.newPassword}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={interpolate(m.account.passwordMin, { min: MIN_PASSWORD_LENGTH })}
        error={errors?.password}
      />
      <Input
        label={m.auth.confirmPassword}
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        error={errors?.confirm}
      />

      <Submit label={m.account.changePassword} />
    </form>
  );
}
