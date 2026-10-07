'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LOCALES } from '@/i18n/config';
import { scrollEdges } from '@/lib/scrollEdges';

export type NavItem = { href: string; label: string; badge?: number };

const ROOTS = new Set(['/account', '/pro/dashboard', '/admin']);
const LOCALE_PREFIX = new RegExp(`^/(${LOCALES.join('|')})(?=/|$)`);

/** Compare paths without their locale prefix — `/ar/x` and `/x` are one page. */
function bare(path: string): string {
  return path.replace(LOCALE_PREFIX, '') || '/';
}

function isActive(pathname: string, href: string): boolean {
  const here = bare(pathname);
  const target = bare(href);
  if (here === target) return true;
  // Section roots would otherwise match every page beneath them.
  return !ROOTS.has(target) && here.startsWith(`${target}/`);
}

/**
 * Horizontal section navigation.
 *
 * Scrolls on narrow screens rather than wrapping into a tall block, which
 * raises two problems this solves. A clipped row gives no hint that more
 * exists, so each edge fades only while there is something past it. And the
 * active tab could sit off-screen, so it is scrolled into view on arrival.
 *
 * One underline slides between tabs instead of each tab owning its own, so a
 * change of section shows where you moved from, not only where you are.
 */
export function SectionNav({ items, label = 'Sections' }: { items: NavItem[]; label?: string }) {
  const pathname = usePathname();
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);

  const measureEdges = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    // A fade marks the side that still has more tabs to scroll to.
    const { atStart, atEnd } = scrollEdges(el);
    setEdges({ start: !atStart, end: !atEnd });
  }, []);

  const measureBar = useCallback(() => {
    const el = scroller.current;
    const active = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !active) return setBar(null);
    setBar({ x: active.offsetLeft, w: active.offsetWidth });
  }, []);

  useLayoutEffect(() => {
    measureBar();
    const active = scroller.current?.querySelector<HTMLElement>('[aria-current="page"]');
    // `nearest` leaves an already visible tab alone instead of jolting the row.
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    measureEdges();
  }, [pathname, measureBar, measureEdges]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      measureBar();
      measureEdges();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [measureBar, measureEdges]);

  return (
    <nav
      className="z-subnav"
      aria-label={label}
      data-fade-start={edges.start}
      data-fade-end={edges.end}
    >
      <div className="z-subnav__scroll" ref={scroller} onScroll={measureEdges}>
        {items.map((item) => {
          const active = isActive(pathname, item.href);
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
        {bar ? (
          <span
            className="z-subnav__bar"
            aria-hidden="true"
            style={{ transform: `translateX(${bar.x}px)`, width: bar.w }}
          />
        ) : null}
      </div>
    </nav>
  );
}
