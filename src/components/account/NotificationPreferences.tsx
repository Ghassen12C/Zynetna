'use client';

import { useOptimistic, useTransition } from 'react';
import { setNotificationPreferenceAction } from '@/server/actions/notificationPrefs';

export type PrefRow = {
  type: string;
  label: string;
  inApp: boolean;
  email: boolean;
  inAppLocked: boolean;
};

type Toggle = { type: string; channel: 'IN_APP' | 'EMAIL'; enabled: boolean };

/**
 * Notification preferences.
 *
 * Toggling is optimistic because the alternative — a spinner on a checkbox —
 * makes a settings screen feel broken. The server remains the authority: it
 * refuses changes to notices that must stay on, and the next render shows what
 * was actually stored.
 */
export function NotificationPreferences({
  rows,
  labels,
}: {
  rows: PrefRow[];
  labels: { inApp: string; byEmail: string; alwaysOn: string };
}) {
  const [, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(rows, (state, change: Toggle) =>
    state.map((row) =>
      row.type === change.type
        ? { ...row, [change.channel === 'IN_APP' ? 'inApp' : 'email']: change.enabled }
        : row,
    ),
  );

  function toggle(type: string, channel: Toggle['channel'], enabled: boolean) {
    startTransition(async () => {
      applyOptimistic({ type, channel, enabled });
      const data = new FormData();
      data.set('type', type);
      data.set('channel', channel);
      data.set('enabled', String(enabled));
      await setNotificationPreferenceAction({ status: 'idle' }, data);
    });
  }

  return (
    <table className="z-prefs">
      <thead>
        <tr>
          <th scope="col" />
          <th scope="col">{labels.inApp}</th>
          <th scope="col">{labels.byEmail}</th>
        </tr>
      </thead>
      <tbody>
        {optimistic.map((row) => (
          <tr key={row.type}>
            <th scope="row">{row.label}</th>
            <td>
              {row.inAppLocked ? (
                // Not a disabled checkbox: a control that cannot move should
                // say why rather than look broken.
                <span className="z-prefs__locked">{labels.alwaysOn}</span>
              ) : (
                <label className="z-switch">
                  <input
                    type="checkbox"
                    checked={row.inApp}
                    onChange={(e) => toggle(row.type, 'IN_APP', e.target.checked)}
                    aria-label={`${row.label} — ${labels.inApp}`}
                  />
                  <span aria-hidden="true" />
                </label>
              )}
            </td>
            <td>
              <label className="z-switch">
                <input
                  type="checkbox"
                  checked={row.email}
                  onChange={(e) => toggle(row.type, 'EMAIL', e.target.checked)}
                  aria-label={`${row.label} — ${labels.byEmail}`}
                />
                <span aria-hidden="true" />
              </label>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
