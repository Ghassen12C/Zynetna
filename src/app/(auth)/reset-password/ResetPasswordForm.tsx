'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { resetPasswordAction } from '@/server/actions/auth';
import { idle } from '@/lib/formState';
import { MIN_PASSWORD_LENGTH } from '@/domain/identity/password';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block loading={pending}>
      Enregistrer le mot de passe
    </Button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, idle);
  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  if (state.status === 'success') {
    return (
      <>
        <Alert tone="success">{state.message}</Alert>
        <ButtonLink href="/login" size="lg" block>
          Se connecter
        </ButtonLink>
      </>
    );
  }

  return (
    <form action={formAction} className="z-auth__form" noValidate>
      <input type="hidden" name="token" value={token} />

      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

      <Input
        label="Nouveau mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={`${MIN_PASSWORD_LENGTH} caractères minimum, avec un chiffre ou un symbole.`}
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

      <p className="z-auth__foot">
        <Link href="/forgot-password">Demander un nouveau lien</Link>
      </p>
    </form>
  );
}
