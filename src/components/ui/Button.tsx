import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import Link from 'next/link';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

type BaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
  className?: string;
};

function classes({ variant = 'primary', size = 'md', block, className }: BaseProps) {
  return [
    'z-btn',
    `z-btn--${variant}`,
    `z-btn--${size}`,
    block ? 'z-btn--block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

export const Button = forwardRef<
  HTMLButtonElement,
  BaseProps & ButtonHTMLAttributes<HTMLButtonElement>
>(function Button(
  { variant, size, block, loading, leading, trailing, children, className, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={classes({ variant, size, block, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="z-spinner" aria-hidden="true" /> : leading}
      {children}
      {!loading && trailing}
    </button>
  );
});

/** Same visual language for navigation, with correct link semantics. */
export function ButtonLink({
  href,
  variant,
  size,
  block,
  leading,
  trailing,
  children,
  className,
  ...rest
}: BaseProps & { href: string } & Omit<
    React.ComponentProps<typeof Link>,
    'href' | 'className' | 'children'
  >) {
  return (
    <Link href={href} className={classes({ variant, size, block, className })} {...rest}>
      {leading}
      {children}
      {trailing}
    </Link>
  );
}
