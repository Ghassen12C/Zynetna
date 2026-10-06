'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavItem = { href: string; label: string; badge?: number };

/**
 * Horizontal section navigation. Scrolls on narrow screens rather than
 * wrapping into a tall block that pushes content off the fold.
 */
export function SectionNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="z-subnav" aria-label="Sections">
      <div className="z-subnav__scroll">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/account' && item.href !== '/pro/dashboard' && item.href !== '/admin' &&
              pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`z-subnav__link ${active ? 'is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
              {item.badge ? <span className="z-subnav__badge">{item.badge}</span> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
