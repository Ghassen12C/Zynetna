'use client';

import Link from 'next/link';
import { Fragment, useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { registerAction } from '@/server/actions/auth';
import { idle } from '@/lib/formState';
import { MIN_PASSWORD_LENGTH, strengthOf } from '@/domain/identity/password';
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

/**
 * The consent sentence with its two links placed where each language puts
 * them, rather than glued together from fragments.
 */
function AcceptTerms({ m, locale }: { m: Messages['auth']; locale: Locale }) {
  const links: Record<string, React.ReactNode> = {
    terms: <Link href={localePath(locale, '/legal/terms')}>{m.termsLink}</Link>,
    privacy: <Link href={localePath(locale, '/legal/privacy')}>{m.privacyLink}</Link>,
  };
  return (
    <>
      {m.acceptTerms.split(/(\{\w+\})/).map((part, i) => {
        const key = /^\{(\w+)\}$/.exec(part)?.[1];
        return <Fragment key={i}>{key && links[key] ? links[key] : part}</Fragment>;
      })}
    </>
  );
}

export function RegisterForm({ m, locale }: { m: Messages['auth']; locale: Locale }) {
  const [state, formAction] = useActionState(registerAction, idle);
  const [password, setPassword] = useState('');
  const strength = password ? strengthOf(password) : null;
  const errors = state.status === 'error' ? state.fieldErrors : undefined;
  const strengthLabel = {
    weak: m.strengthWeak,
    fair: m.strengthFair,
    good: m.strengthGood,
    strong: m.strengthStrong,
  };

  return (
    <form action={formAction} className="z-auth__form" noValidate>
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

      <div className="z-auth__row">
        <Input label={m.firstName} name="firstName" autoComplete="given-name" required error={errors?.firstName} />
        <Input label={m.lastName} name="lastName" autoComplete="family-name" required error={errors?.lastName} />
      </div>

      <Input
        label={m.email}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        error={errors?.email}
      />

      <Input
        label={m.phone}
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="20 123 456"
        optional
        hint={m.phoneHint}
        error={errors?.phone}
      />

      <div>
        <Input
          label={m.password}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={interpolate(m.passwordHint, { min: MIN_PASSWORD_LENGTH })}
          error={errors?.password}
        />
        {strength ? (
          <p className={`z-strength z-strength--${strength}`} aria-live="polite">
            <span className="z-strength__bar" aria-hidden="true">
              <span />
            </span>
            {strengthLabel[strength]}
          </p>
        ) : null}
      </div>

      <label className="z-check">
        <input type="checkbox" name="acceptTerms" required />
        <span>
          <AcceptTerms m={m} locale={locale} />
        </span>
      </label>
      {errors?.acceptTerms ? <p className="z-error">{errors.acceptTerms}</p> : null}

      <Submit label={m.submitRegister} />
    </form>
  );
}
