'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { changePasswordAction } from '@/server/actions/auth';
import { idle } from '@/lib/formState';
import { MIN_PASSWORD_LENGTH } from '@/domain/identity/password';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" loading={pending}>
      Changer le mot de passe
    </Button>
  );
}

export function PasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, idle);
  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="z-auth__form">
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}
      {state.status === 'success' ? <Alert tone="success">{state.message}</Alert> : null}

      <Input
        label="Mot de passe actuel"
        name="current"
        type="password"
        autoComplete="current-password"
        required
        error={errors?.current}
      />
      <Input
        label="Nouveau mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={`${MIN_PASSWORD_LENGTH} caractères minimum.`}
        error={errors?.password}
      />
      <Input
        label="Confirmer"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        error={errors?.confirm}
      />

      <Submit />
    </form>
  );
}
