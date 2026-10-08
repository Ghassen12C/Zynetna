'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { cancelReservationAction } from '@/server/actions/booking';
import { idle } from '@/lib/formState';
import type { Messages } from '@/i18n';

function CancelSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" loading={pending}>
      {label}
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
  canCancel,
  cancelReason,
  canReschedule,
  rescheduleReason,
  m,
  bookPath,
}: {
  reservationId: string;
  canCancel: boolean;
  cancelReason: string | null;
  canReschedule: boolean;
  rescheduleReason: string | null;
  m: Messages['booking'];
  /** Locale-aware booking path for this business. */
  bookPath: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState(cancelReservationAction, idle);

  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

  if (!canCancel && !canReschedule) {
    return (
      <div className="z-confirm__manage">
        <p className="z-policy">{cancelReason ?? rescheduleReason}</p>
      </div>
    );
  }

  return (
    <div className="z-confirm__manage">
      <h2 className="z-profile__h3">{m.manageAppointment}</h2>

      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}
      {state.status === 'success' ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="z-confirm__manage-actions">
        {canReschedule ? (
          <ButtonLink
            href={`${bookPath}?reschedule=${reservationId}`}
            variant="secondary"
          >
            {m.changeDate}
          </ButtonLink>
        ) : (
          <p className="z-policy">{rescheduleReason}</p>
        )}

        {canCancel ? (
          confirming ? (
            <form action={formAction} className="z-confirm__cancel">
              <input type="hidden" name="reservationId" value={reservationId} />
              <p>{m.cancelConfirm}</p>
              <div className="z-row" style={{ gap: 'var(--z-space-2)' }}>
                <CancelSubmit label={m.yesCancel} />
                <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                  {m.keepIt}
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              {m.cancel}
            </Button>
          )
        ) : (
          <p className="z-policy">{cancelReason}</p>
        )}
      </div>
    </div>
  );
}
