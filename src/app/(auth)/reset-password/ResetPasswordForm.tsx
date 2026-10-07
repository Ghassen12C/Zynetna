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
import { localePath, type Locale } from '@/i18n/config';
import { interpolate } from '@/i18n/interpolate';
import type { Messages } from '@/i18n';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block loading={pending}>
      {label}
    </Button>
  );
}

export function ResetPasswordForm({
  token,
  m,
  locale,
}: {
  token: string;
  m: Messages['auth'];
  locale: Locale;
}) {
  const [state, formAction] = useActionState(resetPasswordAction, idle);
  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  if (state.status === 'success') {
    return (
      <>
        <Alert tone="success">{state.message}</Alert>
        <ButtonLink href={localePath(locale, '/login')} size="lg" block>
          {m.submitLogin}
        </ButtonLink>
      </>
    );
  }

  return (
    <form action={formAction} className="z-auth__form" noValidate>
      <input type="hidden" name="token" value={token} />

      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

      <Input
        label={m.newPassword}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={interpolate(m.passwordHint, { min: MIN_PASSWORD_LENGTH })}
        error={errors?.password}
      />
      <Input
        label={m.confirmPassword}
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        error={errors?.confirm}
      />

      <Submit label={m.savePassword} />

      <p className="z-auth__foot">
        <Link href={localePath(locale, '/forgot-password')}>{m.requestNewLink}</Link>
      </p>
    </form>
  );
}
