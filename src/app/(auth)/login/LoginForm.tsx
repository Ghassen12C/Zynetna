'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { loginAction } from '@/server/actions/auth';
import { idle } from '@/lib/formState';
import { localePath, type Locale } from '@/i18n/config';
import type { Messages } from '@/i18n';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block loading={pending}>
      {label}
    </Button>
  );
}

export function LoginForm({
  redirectTo,
  m,
  locale,
}: {
  redirectTo?: string;
  m: Messages['auth'];
  locale: Locale;
}) {
  const [state, formAction] = useActionState(loginAction, idle);

  return (
    <form action={formAction} className="z-auth__form" noValidate>
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

      <Input
        label={m.email}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        error={state.status === 'error' ? state.fieldErrors?.email : null}
      />

      <Input
        label={m.password}
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.status === 'error' ? state.fieldErrors?.password : null}
      />

      <Submit label={m.submitLogin} />

      <p className="z-auth__foot">
        <Link href={localePath(locale, '/forgot-password')}>{m.forgot}</Link>
      </p>
    </form>
  );
}
