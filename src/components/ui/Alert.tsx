import type { ReactNode } from 'react';

export function Alert({
  tone = 'info',
  children,
}: {
  tone?: 'error' | 'success' | 'warning' | 'info';
  children: ReactNode;
}) {
  return (
    <div
      className={`z-alert z-alert--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      {children}
    </div>
  );
}
