'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Mark } from '@/components/brand/Mark';
import { Button, ButtonLink } from '@/components/ui/Button';
import { DEFAULT_LOCALE, isLocale, localePath, type Locale } from '@/i18n/config';
import type { Messages } from '@/i18n';

type Copy = Pick<Messages, 'errors' | 'common'>;

/** The locale the root layout rendered, read from `<html lang>`. */
function useDocumentLocale(): Locale {
  return useSyncExternalStore(
    () => () => undefined,
    () => {
      const lang = document.documentElement.lang;
      return isLocale(lang) ? lang : DEFAULT_LOCALE;
    },
    () => DEFAULT_LOCALE,
  );
}

/**
 * An error boundary cannot receive the dictionary from a server parent, and
 * shipping all three dictionaries with every page for a screen that rarely
 * shows would be waste. The visitor's language is loaded only when it is
 * needed, here.
 */
async function loadCopy(locale: Locale): Promise<Copy> {
  const messages =
    locale === 'ar'
      ? (await import('@/i18n/messages/ar')).ar
      : locale === 'en'
        ? (await import('@/i18n/messages/en')).en
        : (await import('@/i18n/messages/fr')).fr;
  return { errors: messages.errors, common: messages.common };
}

/**
 * Error boundary. The user gets a readable sentence and a way forward; the
 * digest is shown so a support request can be tied to a server log line
 * without exposing the stack trace.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useDocumentLocale();
  const [copy, setCopy] = useState<Copy | null>(null);

  useEffect(() => {
    // Server errors are already logged server-side; this captures the client
    // half of the picture.
    console.error('Unhandled application error', error.digest ?? error.message);
  }, [error]);

  useEffect(() => {
    let live = true;
    loadCopy(locale)
      .then((loaded) => live && setCopy(loaded))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [locale]);

  return (
    <div className="z-errorpage" aria-busy={copy ? undefined : true}>
      <Mark size={64} />
      {copy ? (
        <>
          <h1>{copy.common.error}</h1>
          <p>{copy.errors.serverLong}</p>
        </>
      ) : null}
      <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button onClick={reset}>{copy ? copy.common.retry : <span aria-hidden="true">↻</span>}</Button>
        {copy ? (
          <ButtonLink href={localePath(locale, '/')} variant="secondary">
            {copy.errors.backHome}
          </ButtonLink>
        ) : null}
      </div>
      {error.digest && copy ? (
        <p className="z-help">
          {/* The digest stays a left-to-right token inside an Arabic sentence. */}
          {copy.errors.reference.split('{digest}')[0]}
          <bdi dir="ltr">{error.digest}</bdi>
          {copy.errors.reference.split('{digest}')[1]}
        </p>
      ) : null}
    </div>
  );
}
