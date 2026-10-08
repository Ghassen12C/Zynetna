'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { logoutAction } from '@/server/actions/auth';

/** A door with an arrow leaving it; mirrored in RTL by the stylesheet. */
function LogoutIcon() {
  return (
    <svg
      className="z-logout__icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function Submit({
  label,
  variant,
  size,
  block,
  compact,
}: {
  label: string;
  variant: 'primary' | 'secondary' | 'ghost';
  size: 'sm' | 'md';
  block?: boolean;
  compact?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      block={block}
      loading={pending}
      className={compact ? 'z-logout z-logout--compact' : 'z-logout'}
      title={label}
      aria-label={compact ? label : undefined}
    >
      <LogoutIcon />
      <span className="z-logout__text">{label}</span>
    </Button>
  );
}

/**
 * Sign out. A form posting to a server action, so it works before any
 * JavaScript has loaded. `compact` hides the text on narrower desktop widths
 * (the icon stays, with the label as its accessible name and tooltip).
 */
export function LogoutButton({
  label,
  variant = 'ghost',
  size = 'md',
  block,
  compact,
  className,
}: {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
  block?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <form action={logoutAction} className={className}>
      <Submit label={label} variant={variant} size={size} block={block} compact={compact} />
    </form>
  );
}
