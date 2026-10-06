'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { logoutAction } from '@/server/actions/auth';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" loading={pending}>
      Se déconnecter
    </Button>
  );
}

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Submit />
    </form>
  );
}
