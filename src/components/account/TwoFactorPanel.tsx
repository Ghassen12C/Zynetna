'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import {
  confirmTwoFactorAction,
  disableTwoFactorAction,
  regenerateRecoveryCodesAction,
  startTwoFactorAction,
} from '@/server/actions/twoFactor';
import { type FormState, idle } from '@/lib/formState';
import { interpolate } from '@/i18n/interpolate';
import { formatCount, formatDate } from '@/i18n/format';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n';

type M = { auth: Messages['auth']; account: Messages['account']; common: Messages['common'] };

function Submit({
  label,
  variant = 'primary',
}: {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} loading={pending}>
      {label}
    </Button>
  );
}

function CodeInput({ label }: { label: string }) {
  return (
    <Input
      label={label}
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={7}
      required
      dir="ltr"
      className="z-otp"
    />
  );
}

/** Recovery codes, shown once, with a copy button. */
function RecoveryCodes({ codes, m, onDone }: { codes: string[]; m: M; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const a = m.account;
  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-3)' }}>
      <h3 className="z-label">{a.recoveryTitle}</h3>
      <Alert tone="warning">{a.recoveryIntro}</Alert>
      <ul className="z-codes" dir="ltr">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void navigator.clipboard?.writeText(codes.join('\n')).then(() => setCopied(true));
          }}
        >
          {copied ? a.recoveryCopied : a.recoveryCopy}
        </Button>
        <Button type="button" onClick={onDone}>
          {a.recoverySaved}
        </Button>
      </div>
    </div>
  );
}

/** Off: turn it on in two steps — scan, then confirm with a first code. */
function Enroll({
  m,
  started,
  start,
  confirmed,
  confirm,
}: {
  m: M;
  started: FormState<{ qrDataUrl: string; secret: string }>;
  start: (formData: FormData) => void;
  confirmed: FormState<{ codes: string[] }>;
  confirm: (formData: FormData) => void;
}) {
  const a = m.account;

  if (started.status !== 'success' || !started.data) {
    return (
      <form action={start} className="z-stack" style={{ gap: 'var(--z-space-3)' }}>
        {started.status === 'error' ? <Alert tone="error">{started.message}</Alert> : null}
        <p className="z-policy">{a.twoFactorIsOff}</p>
        <div>
          <Submit label={a.twoFactorEnable} />
        </div>
      </form>
    );
  }

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-4)' }}>
      <p className="z-policy">{a.twoFactorScan}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={started.data.qrDataUrl} alt="" width={180} height={180} className="z-qr" />
      <p className="z-help">
        {a.twoFactorManual}{' '}
        <code className="z-secret" dir="ltr">
          {started.data.secret}
        </code>
      </p>
      <form action={confirm} className="z-auth__form">
        {confirmed.status === 'error' ? <Alert tone="error">{confirmed.message}</Alert> : null}
        <CodeInput label={a.twoFactorConfirmLabel} />
        <div>
          <Submit label={a.twoFactorConfirm} />
        </div>
      </form>
    </div>
  );
}

/** On: status, new recovery codes, or turn off. */
function Manage({
  enabledAt,
  recoveryLeft,
  m,
  locale,
  regenerated,
  regenerate,
  disabled,
  disable,
}: {
  enabledAt: string;
  recoveryLeft: number;
  m: M;
  locale: Locale;
  regenerated: FormState<{ codes: string[] }>;
  regenerate: (formData: FormData) => void;
  disabled: FormState;
  disable: (formData: FormData) => void;
}) {
  const a = m.account;
  const [open, setOpen] = useState<'codes' | 'disable' | null>(null);

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-3)' }}>
      <p className="z-policy">
        {interpolate(a.twoFactorOnSince, { date: formatDate(new Date(enabledAt), locale) })}{' '}
        {formatCount(a.recoveryLeft, recoveryLeft, locale)}
      </p>

      {open === null ? (
        <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
          <Button type="button" variant="secondary" onClick={() => setOpen('codes')}>
            {a.twoFactorRegenerate}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen('disable')}>
            {a.twoFactorDisable}
          </Button>
        </div>
      ) : null}

      {open === 'codes' ? (
        <form action={regenerate} className="z-auth__form">
          {regenerated.status === 'error' ? <Alert tone="error">{regenerated.message}</Alert> : null}
          <CodeInput label={m.auth.verifyCodeLabel} />
          <div className="z-row" style={{ gap: 'var(--z-space-2)' }}>
            <Submit label={a.twoFactorRegenerate} />
            <Button type="button" variant="ghost" onClick={() => setOpen(null)}>
              {m.common.cancel}
            </Button>
          </div>
        </form>
      ) : null}

      {open === 'disable' ? (
        <form action={disable} className="z-auth__form">
          <p className="z-help">{a.twoFactorDisableIntro}</p>
          {disabled.status === 'error' ? <Alert tone="error">{disabled.message}</Alert> : null}
          <Input
            label={a.currentPassword}
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <Input
            label={a.twoFactorCodeOrRecovery}
            name="code"
            autoComplete="one-time-code"
            required
            dir="ltr"
          />
          <div className="z-row" style={{ gap: 'var(--z-space-2)' }}>
            <Submit label={a.twoFactorDisable} variant="danger" />
            <Button type="button" variant="ghost" onClick={() => setOpen(null)}>
              {m.common.cancel}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

/**
 * The action states live here, above the on/off switch: a server action can
 * refresh the page, which flips this panel from "off" to "on" in the same
 * render. Kept in a child, the recovery codes would vanish before anyone could
 * write them down.
 */
export function TwoFactorPanel({
  enabledAt,
  recoveryLeft,
  m,
  locale,
}: {
  enabledAt: string | null;
  recoveryLeft: number;
  m: M;
  locale: Locale;
}) {
  const router = useRouter();
  const [started, start] = useActionState(startTwoFactorAction, idle);
  const [confirmed, confirm] = useActionState(confirmTwoFactorAction, idle);
  const [regenerated, regenerate] = useActionState(regenerateRecoveryCodesAction, idle);
  const [disabled, disable] = useActionState(disableTwoFactorAction, idle);
  // Which result has been acknowledged, so "done" does not show it again.
  const [seen, setSeen] = useState<unknown>(null);

  const codes =
    confirmed.status === 'success' && confirmed.data && seen !== confirmed
      ? { codes: confirmed.data.codes, from: confirmed }
      : regenerated.status === 'success' && regenerated.data && seen !== regenerated
        ? { codes: regenerated.data.codes, from: regenerated }
        : null;

  let body;
  if (codes) {
    body = (
      <RecoveryCodes
        codes={codes.codes}
        m={m}
        onDone={() => {
          setSeen(codes.from);
          router.refresh();
        }}
      />
    );
  } else if (disabled.status === 'success' && seen !== disabled) {
    body = (
      <div className="z-stack" style={{ gap: 'var(--z-space-3)' }}>
        <Alert tone="success">{disabled.message}</Alert>
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setSeen(disabled);
              router.refresh();
            }}
          >
            {m.common.close}
          </Button>
        </div>
      </div>
    );
  } else if (enabledAt) {
    body = (
      <Manage
        enabledAt={enabledAt}
        recoveryLeft={recoveryLeft}
        m={m}
        locale={locale}
        regenerated={regenerated}
        regenerate={regenerate}
        disabled={disabled}
        disable={disable}
      />
    );
  } else {
    body = <Enroll m={m} started={started} start={start} confirmed={confirmed} confirm={confirm} />;
  }

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-3)' }}>
      <p className="z-policy">{m.account.twoFactorIntro}</p>
      {body}
    </div>
  );
}
