'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Primitives';
import { updateFlagAction } from '@/server/actions/admin';
import { idle } from '@/lib/formState';

type Flag = { key: string; description: string | null; isEnabled: boolean; rolloutPct: number };

function Submit({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={enabled ? 'ghost' : 'primary'} loading={pending}>
      {enabled ? 'Désactiver' : 'Activer'}
    </Button>
  );
}

function Row({ flag }: { flag: Flag }) {
  const router = useRouter();
  const [, formAction] = useActionState(updateFlagAction, idle);

  return (
    <form
      action={formAction}
      className="z-setting"
      onSubmit={() => setTimeout(() => router.refresh(), 400)}
    >
      <input type="hidden" name="key" value={flag.key} />
      <input type="hidden" name="isEnabled" value={flag.isEnabled ? 'false' : 'true'} />
      <input type="hidden" name="rolloutPct" value={flag.rolloutPct} />

      <div className="z-setting__label">
        <strong>{flag.description ?? flag.key}</strong>
        <code className="z-code">{flag.key}</code>
      </div>
      <div className="z-setting__control">
        <Badge tone={flag.isEnabled ? 'success' : 'neutral'}>
          {flag.isEnabled ? 'Activée' : 'Désactivée'}
        </Badge>
        <Submit enabled={flag.isEnabled} />
      </div>
    </form>
  );
}

export function FlagsEditor({ flags }: { flags: Flag[] }) {
  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-4)' }}>
      {flags.map((flag) => (
        <Row key={flag.key} flag={flag} />
      ))}
    </div>
  );
}
