'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

export type MenuLink = { href: string; label: string; emphasis?: 'primary' | 'quiet' };

/**
 * The header's navigation below 900px.
 *
 * Without it a phone had no way to reach search or categories from the header
 * at all — the desktop links were simply hidden. This is a disclosure panel,
 * not a modal: it pushes nothing, traps nothing, and closes on navigation, on
 * Escape and on a tap outside, which is what a thumb expects.
 */
export function MobileMenu({
  links,
  actions,
  labels,
}: {
  links: MenuLink[];
  actions: MenuLink[];
  labels: { open: string; close: string };
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);

  // Following a link closes the menu.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div className="z-mmenu" ref={root} data-open={open}>
      <button
        type="button"
        className="z-mmenu__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? labels.close : labels.open}
        onClick={() => setOpen((v) => !v)}
      >
        {/* Three bars that fold into a cross — the change of state is the
            feedback, so no separate icon swap. */}
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      <div id={panelId} className="z-mmenu__panel" hidden={!open}>
        <nav className="z-mmenu__links">
          {links.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              className="z-mmenu__link"
              style={{ ['--i' as string]: i }}
              aria-current={pathname === link.href ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        {actions.length > 0 ? (
          <div className="z-mmenu__actions">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={`z-btn z-btn--md z-btn--block ${
                  action.emphasis === 'primary' ? 'z-btn--primary' : 'z-btn--secondary'
                }`}
              >
                {action.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
