import type { ReactNode } from 'react';

export function Card({
  children,
  interactive,
  className,
}: {
  children: ReactNode;
  interactive?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`z-card ${interactive ? 'z-card--interactive' : ''} ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`z-panel ${className ?? ''}`}>{children}</div>;
}

export type BadgeTone = 'neutral' | 'accent' | 'gold' | 'success' | 'warning' | 'danger';

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return <span className={`z-badge z-badge--${tone} ${className ?? ''}`}>{children}</span>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="z-eyebrow">{children}</p>;
}

export function Skeleton({
  width,
  height = 16,
  radius,
  className,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  className?: string;
}) {
  return (
    <span
      className={`z-skeleton ${className ?? ''}`}
      style={{
        display: 'block',
        width: width ?? '100%',
        height,
        borderRadius: radius ?? undefined,
      }}
      aria-hidden="true"
    />
  );
}

/**
 * Empty states always say what the user can do next — a bare "nothing here"
 * leaves someone stuck.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--z-space-3)',
        padding: 'var(--z-space-12) var(--z-space-6)',
        textAlign: 'center',
      }}
    >
      {icon ? <div style={{ opacity: 0.5 }}>{icon}</div> : null}
      <h3 style={{ fontSize: 'var(--z-text-lg)' }}>{title}</h3>
      {body ? (
        <p style={{ color: 'var(--z-fg-muted)', maxWidth: '42ch' }}>{body}</p>
      ) : null}
      {action ? <div style={{ marginTop: 'var(--z-space-2)' }}>{action}</div> : null}
    </div>
  );
}

// Rating reads the page's language from context, so it lives in its own
// client module; re-exported here so existing imports keep working.
export { Rating } from './Rating';
