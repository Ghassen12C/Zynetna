'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { saveD17SettingsAction } from '@/server/actions/payments';
import { idle } from '@/lib/formState';
import type { Messages } from '@/i18n';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

/**
 * Admin: the D17 QR code professionals scan to pay. The image is uploaded
 * here rather than committed to the repository: it identifies a real wallet.
 */
export function D17SettingsForm({
  settings,
  m,
}: {
  settings: { enabled: boolean; hasQr: boolean; holder: string; phone: string; version: string };
  m: Pick<Messages, 'admin' | 'common'>;
}) {
  const d = m.admin.d17;
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveD17SettingsAction, idle);
  useEffect(() => {
    if (state.status === 'success') {
      router.refresh();
      const file = formRef.current?.elements.namedItem('qr');
      if (file instanceof HTMLInputElement) file.value = '';
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="z-auth__form">
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}
      {state.status === 'success' ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="z-d17__setup">
        {settings.hasQr ? (
          <figure className="z-d17__qr">
            {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-gated route */}
            <img src={`/api/payments/d17-qr?v=${settings.version}`} alt={d.currentQr} width={220} />
            <figcaption className="z-help">{d.currentQr}</figcaption>
          </figure>
        ) : null}
        <div className="z-stack" style={{ gap: 'var(--z-space-4)', flex: 1, minWidth: 0 }}>
          <div className="z-field">
            <label className="z-label" htmlFor="d17-qr">
              {d.qr}
            </label>
            <input
              id="d17-qr"
              type="file"
              name="qr"
              accept="image/jpeg,image/png,image/webp"
              className="z-input"
              aria-describedby="d17-qr-hint"
            />
            <span className="z-help" id="d17-qr-hint">
              {d.qrHint}
            </span>
          </div>
          <Input label={d.holder} name="holder" defaultValue={settings.holder} maxLength={80} />
          <Input
            label={d.phone}
            name="phone"
            defaultValue={settings.phone}
            maxLength={20}
            inputMode="tel"
            dir="ltr"
            optional
          />
          <label className="z-check">
            <input type="checkbox" name="enabled" defaultChecked={settings.enabled} />
            <span>{d.enabled}</span>
          </label>
        </div>
      </div>

      <div>
        <Submit label={m.common.save} />
      </div>
    </form>
  );
}
