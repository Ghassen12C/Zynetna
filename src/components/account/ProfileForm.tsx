'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { updateProfileAction } from '@/server/actions/auth';
import { idle } from '@/lib/formState';
import { LOCALES, LOCALE_META } from '@/i18n/config';
import type { Messages } from '@/i18n';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function ProfileForm({
  user,
  m,
  emailNote,
}: {
  user: { firstName: string; lastName: string; email: string; phone: string | null; locale: string };
  m: { auth: Messages['auth']; account: Messages['account']; common: Messages['common'] };
  /** The "email cannot be changed" sentence, already filled with the address. */
  emailNote: React.ReactNode;
}) {
  const [state, formAction] = useActionState(updateProfileAction, idle);
  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="z-auth__form">
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}
      {state.status === 'success' ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="z-auth__row">
        <Input label={m.auth.firstName} name="firstName" defaultValue={user.firstName} required error={errors?.firstName} />
        <Input label={m.auth.lastName} name="lastName" defaultValue={user.lastName} required error={errors?.lastName} />
      </div>

      <Input
        label={m.auth.phone}
        name="phone"
        type="tel"
        inputMode="tel"
        defaultValue={user.phone ?? ''}
        placeholder="20 123 456"
        optional
        error={errors?.phone}
      />

      <Select label={m.account.language} name="locale" defaultValue={user.locale}>
        {/* Each language is named in itself, so anyone can find their own. */}
        {LOCALES.map((code) => (
          <option key={code} value={code} lang={code}>
            {LOCALE_META[code].nativeLabel}
          </option>
        ))}
      </Select>

      <p className="z-help">{emailNote}</p>

      <Submit label={m.common.save} />
    </form>
  );
}
