'use client';

import { useEffect } from 'react';
import { Mark } from '@/components/brand/Mark';
import { Button, ButtonLink } from '@/components/ui/Button';

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
  useEffect(() => {
    // Server errors are already logged server-side; this captures the client
    // half of the picture.
    console.error('Unhandled application error', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="z-errorpage">
      <Mark size={64} />
      <h1>Une erreur est survenue</h1>
      <p>
        Un problème est survenu de notre côté. Vos données n’ont pas été perdues — réessayez
        dans un instant.
      </p>
      <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button onClick={reset}>Réessayer</Button>
        <ButtonLink href="/" variant="secondary">
          Retour à l’accueil
        </ButtonLink>
      </div>
      {error.digest ? <p className="z-help">Référence : {error.digest}</p> : null}
    </div>
  );
}
