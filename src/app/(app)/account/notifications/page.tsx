import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/ui/Primitives';
import { MarkAllRead } from '@/components/account/MarkAllRead';
import { getActor } from '@/server/auth/session';
import { notifications } from '@/server/services/account';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { getPreferences } from '@/server/services/notificationPrefs';
import { NotificationPreferences } from '@/components/account/NotificationPreferences';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.account.notifications, robots: { index: false } };
}

export default async function NotificationsPage() {
  const actor = await getActor();
  if (!actor) redirect('/login?redirectTo=/account/notifications');

  const [items, preferences, { m, locale }] = await Promise.all([
    notifications(actor),
    getPreferences(actor),
    translate(),
  ]);
  const unread = items.filter((n) => !n.readAt).length;

  const prefRows = preferences.map((row) => ({
    type: row.type,
    label: m.account[`type${row.type}` as keyof typeof m.account] as string,
    inApp: row.inApp,
    email: row.email,
    inAppLocked: row.inAppLocked,
  }));

  const settings = (
    <section className="z-panel z-stack" style={{ gap: 'var(--z-space-3)' }}>
      <div>
        <h2 className="z-profile__h3">{m.account.preferences}</h2>
        <p className="z-policy">{m.account.preferencesBody}</p>
      </div>
      <NotificationPreferences
        rows={prefRows}
        labels={{
          inApp: m.account.inApp,
          byEmail: m.account.byEmail,
          alwaysOn: m.account.alwaysOn,
        }}
      />
      {/* Stated plainly rather than shown as a dead toggle. */}
      <p className="z-help">{m.account.smsSoon}</p>
    </section>
  );

  if (items.length === 0) {
    return (
      <div className="z-stack" style={{ gap: 'var(--z-space-6)' }}>
        <EmptyState
          title={m.account.noNotifications}
          body={m.account.noNotificationsBody}
        />
        {settings}
      </div>
    );
  }

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-6)' }}>
      {unread > 0 ? (
        <MarkAllRead
          count={unread}
          locale={locale}
          m={{ unreadCount: m.account.unreadCount, markAllRead: m.account.markAllRead }}
        />
      ) : null}

      <ul className="z-notifs">
        {items.map((notification) => {
          const content = (
            <>
              <span className="z-notif__dot" aria-hidden="true" data-unread={!notification.readAt} />
              <span className="z-notif__body">
                <strong>{notification.title}</strong>
                <span>{notification.body}</span>
                <RelativeTime value={notification.createdAt.toISOString()} locale={locale} />
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

      {settings}
    </div>
  );
}
