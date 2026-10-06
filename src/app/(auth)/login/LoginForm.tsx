'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { loginAction } from '@/server/actions/auth';
import { idle } from '@/lib/formState';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block loading={pending}>
      Se connecter
    </Button>
  );
}

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction] = useActionState(loginAction, idle);

  return (
    <form action={formAction} className="z-auth__form" noValidate>
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

      <Input
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        error={state.status === 'error' ? state.fieldErrors?.email : null}
      />

      <Input
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.status === 'error' ? state.fieldErrors?.password : null}
      />

      <Submit />

      <p className="z-auth__foot">
        <Link href="/forgot-password">Mot de passe oublié ?</Link>
      </p>
    </form>
  );
}
