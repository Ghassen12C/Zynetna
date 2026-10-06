'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { updateSettingAction } from '@/server/actions/admin';
import { idle } from '@/lib/formState';
import { RelativeTime } from '@/components/ui/RelativeTime';

type Setting = { key: string; label: string; hint: string; value: string; updatedAt: string | null };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" loading={pending}>
      Enregistrer
    </Button>
  );
}

function Row({ setting }: { setting: Setting }) {
  const router = useRouter();
  const [state, formAction] = useActionState(updateSettingAction, idle);
  if (state.status === 'success') router.refresh();

  return (
    <form action={formAction} className="z-setting">
      <input type="hidden" name="key" value={setting.key} />
      <div className="z-setting__label">
        <strong>{setting.label}</strong>
        <span className="z-help">{setting.hint}</span>
        <code className="z-code">{setting.key}</code>
      </div>
      <div className="z-setting__control">
        <input
          type="text"
          name="value"
          className="z-input"
          defaultValue={setting.value}
          aria-label={setting.label}
        />
        <Submit />
      </div>
      {state.status === 'error' ? <p className="z-error">{state.message}</p> : null}
      {setting.updatedAt ? (
        <p className="z-help">
          Modifié <RelativeTime value={setting.updatedAt} />
        </p>
      ) : (
        <p className="z-help">Jamais défini — la valeur par défaut du code s’applique.</p>
      )}
    </form>
  );
}

export function SettingsEditor({ settings, extra }: { settings: Setting[]; extra: Setting[] }) {
  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-5)' }}>
      {[...settings, ...extra].map((setting) => (
        <Row key={setting.key} setting={setting} />
      ))}
    </div>
  );
}
