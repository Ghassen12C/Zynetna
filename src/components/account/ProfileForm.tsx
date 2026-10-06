'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { updateProfileAction } from '@/server/actions/auth';
import { idle } from '@/lib/formState';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Enregistrer
    </Button>
  );
}

export function ProfileForm({
  user,
}: {
  user: { firstName: string; lastName: string; email: string; phone: string | null; locale: string };
}) {
  const [state, formAction] = useActionState(updateProfileAction, idle);
  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="z-auth__form">
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}
      {state.status === 'success' ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="z-auth__row">
        <Input label="Prénom" name="firstName" defaultValue={user.firstName} required error={errors?.firstName} />
        <Input label="Nom" name="lastName" defaultValue={user.lastName} required error={errors?.lastName} />
      </div>

      <Input
        label="Téléphone"
        name="phone"
        type="tel"
        inputMode="tel"
        defaultValue={user.phone ?? ''}
        placeholder="20 123 456"
        optional
        error={errors?.phone}
      />

      <Select label="Langue" name="locale" defaultValue={user.locale}>
        <option value="fr">Français</option>
        <option value="ar">العربية</option>
        <option value="en">English</option>
      </Select>

      <p className="z-help">
        L’adresse e-mail ({user.email}) ne peut pas être modifiée pour l’instant.
      </p>

      <Submit />
    </form>
  );
}
