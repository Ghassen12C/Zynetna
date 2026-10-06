'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { cancelReservationAction } from '@/server/actions/booking';
import { idle } from '@/lib/formState';

function CancelSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" loading={pending}>
      Oui, annuler
    </Button>
  );
}

/**
 * Cancel and reschedule, gated by the business's own policy.
 *
 * When an action is not allowed the control is not merely disabled — the
 * reason is shown, so the customer knows to phone rather than wonder.
 */
export function ReservationActions({
  reservationId,
  businessSlug,
  canCancel,
  cancelReason,
  canReschedule,
  rescheduleReason,
}: {
  reservationId: string;
  businessSlug: string;
  canCancel: boolean;
  cancelReason: string | null;
  canReschedule: boolean;
  rescheduleReason: string | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState(cancelReservationAction, idle);

  if (state.status === 'success') {
    router.refresh();
  }

  if (!canCancel && !canReschedule) {
    return (
      <div className="z-confirm__manage">
        <p className="z-policy">{cancelReason ?? rescheduleReason}</p>
      </div>
    );
  }

  return (
    <div className="z-confirm__manage">
      <h2 className="z-profile__h3">Gérer ce rendez-vous</h2>

      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}
      {state.status === 'success' ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="z-confirm__manage-actions">
        {canReschedule ? (
          <ButtonLink
            href={`/business/${businessSlug}/book?reschedule=${reservationId}`}
            variant="secondary"
          >
            Modifier la date
          </ButtonLink>
        ) : (
          <p className="z-policy">{rescheduleReason}</p>
        )}

        {canCancel ? (
          confirming ? (
            <form action={formAction} className="z-confirm__cancel">
              <input type="hidden" name="reservationId" value={reservationId} />
              <p>Annuler ce rendez-vous ?</p>
              <div className="z-row" style={{ gap: 'var(--z-space-2)' }}>
                <CancelSubmit />
                <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                  Garder
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              Annuler le rendez-vous
            </Button>
          )
        ) : (
          <p className="z-policy">{cancelReason}</p>
        )}
      </div>
    </div>
  );
}
