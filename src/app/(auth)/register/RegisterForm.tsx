'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { registerAction } from '@/server/actions/auth';
import { idle } from '@/lib/formState';
import { MIN_PASSWORD_LENGTH, strengthOf } from '@/domain/identity/password';

const STRENGTH_LABEL = {
  weak: 'Faible',
  fair: 'Moyen',
  good: 'Bon',
  strong: 'Excellent',
} as const;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block loading={pending}>
      Créer mon compte
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, idle);
  const [password, setPassword] = useState('');
  const strength = password ? strengthOf(password) : null;
  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="z-auth__form" noValidate>
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

      <div className="z-auth__row">
        <Input label="Prénom" name="firstName" autoComplete="given-name" required error={errors?.firstName} />
        <Input label="Nom" name="lastName" autoComplete="family-name" required error={errors?.lastName} />
      </div>

      <Input
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        error={errors?.email}
      />

      <Input
        label="Téléphone"
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="20 123 456"
        optional
        hint="Pour recevoir vos rappels de rendez-vous."
        error={errors?.phone}
      />

      <div>
        <Input
          label="Mot de passe"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={`${MIN_PASSWORD_LENGTH} caractères minimum, avec un chiffre ou un symbole.`}
          error={errors?.password}
        />
        {strength ? (
          <p className={`z-strength z-strength--${strength}`} aria-live="polite">
            <span className="z-strength__bar" aria-hidden="true">
              <span />
            </span>
            {STRENGTH_LABEL[strength]}
          </p>
        ) : null}
      </div>

      <label className="z-check">
        <input type="checkbox" name="acceptTerms" required />
        <span>
          J’accepte les <Link href="/legal/terms">conditions d’utilisation</Link> et la{' '}
          <Link href="/legal/privacy">politique de confidentialité</Link>.
        </span>
      </label>
      {errors?.acceptTerms ? <p className="z-error">{errors.acceptTerms}</p> : null}

      <Submit />
    </form>
  );
}
