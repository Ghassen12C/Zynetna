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

/** Star rating. Decorative stars are hidden; the value is announced once. */
export function Rating({
  value,
  count,
  size = 15,
  showValue = true,
}: {
  value: number;
  count?: number;
  size?: number;
  showValue?: boolean;
}) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      aria-label={`${value.toFixed(1)} out of 5${count ? `, ${count} reviews` : ''}`}
    >
      <span style={{ display: 'inline-flex', gap: 1 }} aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} width={size} height={size} viewBox="0 0 20 20">
            <path
              d="M10 1.6l2.47 5.2 5.53.78-4 3.98.95 5.64L10 14.5l-4.95 2.7.95-5.64-4-3.98 5.53-.78L10 1.6Z"
              fill={rounded >= i ? 'var(--z-jasmin)' : 'var(--z-chaux-300)'}
            />
          </svg>
        ))}
      </span>
      {showValue ? (
        <span style={{ fontSize: 'var(--z-text-sm)', fontWeight: 600 }}>
          {value > 0 ? value.toFixed(1) : '—'}
          {count !== undefined ? (
            <span style={{ color: 'var(--z-fg-muted)', fontWeight: 400 }}> ({count})</span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
