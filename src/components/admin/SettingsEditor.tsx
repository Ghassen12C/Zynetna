'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { updateSettingAction } from '@/server/actions/admin';
import { idle } from '@/lib/formState';
import { RelativeTime } from '@/components/ui/RelativeTime';
import type { Messages } from '@/i18n';
import type { Locale } from '@/i18n/config';

type Setting = { key: string; label: string; hint: string; value: string; updatedAt: string | null };

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" loading={pending}>
      {label}
    </Button>
  );
}

type RowProps = { setting: Setting; m: Messages['admin']; saveLabel: string; locale: Locale };

function Row({ setting, m, saveLabel, locale }: RowProps) {
  // "Modifié {when}": the relative time is a component, so split the template around it.
  const [before, after] = m.settings.updated.split('{when}');
  const router = useRouter();
  const [state, formAction] = useActionState(updateSettingAction, idle);
  if (state.status === 'success') router.refresh();

  return (
    <form action={formAction} className="z-setting">
      <input type="hidden" name="key" value={setting.key} />
      <div className="z-setting__label">
        <strong>{setting.label}</strong>
        <span className="z-help">{setting.hint}</span>
        <code className="z-code" dir="ltr">
          {setting.key}
        </code>
      </div>
      <div className="z-setting__control">
        <input
          type="text"
          name="value"
          className="z-input"
          defaultValue={setting.value}
          aria-label={setting.label}
          dir="ltr"
        />
        <Submit label={saveLabel} />
      </div>
      {state.status === 'error' ? <p className="z-error">{state.message}</p> : null}
      {setting.updatedAt ? (
        <p className="z-help">
          {before}
          <RelativeTime value={setting.updatedAt} locale={locale} />
          {after}
        </p>
      ) : (
        <p className="z-help">{m.settings.neverSet}</p>
      )}
    </form>
  );
}

export function SettingsEditor({
  settings,
  extra,
  m,
  saveLabel,
  locale,
}: {
  settings: Setting[];
  extra: Setting[];
  m: Messages['admin'];
  saveLabel: string;
  locale: Locale;
}) {
  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-5)' }}>
      {[...settings, ...extra].map((setting) => (
        <Row key={setting.key} setting={setting} m={m} saveLabel={saveLabel} locale={locale} />
      ))}
    </div>
  );
}
