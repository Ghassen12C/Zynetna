'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { logoutAction } from '@/server/actions/auth';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" loading={pending}>
      {label}
    </Button>
  );
}

export function LogoutButton({ label }: { label: string }) {
  return (
    <form action={logoutAction}>
      <Submit label={label} />
    </form>
  );
}
