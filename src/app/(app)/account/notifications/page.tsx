import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/ui/Primitives';
import { MarkAllRead } from '@/components/account/MarkAllRead';
import { getActor } from '@/server/auth/session';
import { notifications } from '@/server/services/account';
import { RelativeTime } from '@/components/ui/RelativeTime';

export const metadata: Metadata = { title: 'Notifications', robots: { index: false } };

export default async function NotificationsPage() {
  const actor = await getActor();
  if (!actor) redirect('/login?redirectTo=/account/notifications');

  const items = await notifications(actor);
  const unread = items.filter((n) => !n.readAt).length;

  if (items.length === 0) {
    return (
      <EmptyState
        title="Aucune notification"
        body="Vos confirmations, rappels et mises à jour de rendez-vous apparaîtront ici."
      />
    );
  }

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-4)' }}>
      {unread > 0 ? <MarkAllRead count={unread} /> : null}

      <ul className="z-notifs">
        {items.map((notification) => {
          const content = (
            <>
              <span className="z-notif__dot" aria-hidden="true" data-unread={!notification.readAt} />
              <span className="z-notif__body">
                <strong>{notification.title}</strong>
                <span>{notification.body}</span>
                <RelativeTime value={notification.createdAt.toISOString()} />
              </span>
            </>
          );
          return (
            <li key={notification.id} className={notification.readAt ? '' : 'is-unread'}>
              {notification.link ? (
                <Link href={notification.link} className="z-notif">
                  {content}
                </Link>
              ) : (
                <div className="z-notif">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
