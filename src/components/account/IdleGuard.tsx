'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { idleLogoutAction } from '@/server/actions/auth';
import { interpolate } from '@/i18n/interpolate';

const STORAGE_KEY = 'zynetna:lastActivity';
const PING_EVERY_MS = 4 * 60_000;
const CHECK_EVERY_MS = 5_000;
const WARN_BEFORE_MS = 60_000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

function readShared(): number | null {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeShared(at: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    /* private mode: this tab still works on its own */
  }
}

/**
 * Signs an unattended screen out after the account's idle limit, with a
 * one-minute warning. Activity in any tab of the site counts (shared through
 * localStorage), and while someone is active a light ping keeps the server
 * session alive. The server enforces the same limit regardless; this only
 * stops a left-open page from going on showing data.
 */
export function IdleGuard({
  idleMs: serverIdleMs,
  labels,
}: {
  idleMs: number;
  labels: { warning: string; stay: string };
}) {
  // The server last heard from us up to one ping interval before the latest
  // activity, so leave a little earlier than it would: the person always gets
  // the warning, never a page that has silently stopped working.
  const idleMs = Math.max(2 * WARN_BEFORE_MS, serverIdleMs - PING_EVERY_MS - WARN_BEFORE_MS);
  const last = useRef(Date.now());
  const lastPing = useRef(Date.now());
  const leaving = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    void idleLogoutAction();
  }, []);

  const ping = useCallback(() => {
    lastPing.current = Date.now();
    fetch('/api/auth/ping', { method: 'POST', credentials: 'same-origin' })
      .then((response) => {
        // Signed out elsewhere, or the server already ended it.
        if (response.status === 401) leave();
      })
      .catch(() => undefined);
  }, [leave]);

  const markActive = useCallback(() => {
    const now = Date.now();
    // Cheap: at most one write a second, however busy the mouse.
    if (now - last.current < 1_000) return;
    last.current = now;
    writeShared(now);
    if (now - lastPing.current > PING_EVERY_MS) ping();
  }, [ping]);

  useEffect(() => {
    writeShared(Date.now());
    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, markActive, { passive: true, capture: true });
    }
    const timer = window.setInterval(() => {
      const latest = Math.max(last.current, readShared() ?? 0);
      last.current = latest;
      const left = idleMs - (Date.now() - latest);
      if (left <= 0) {
        leave();
      } else {
        setSecondsLeft(left <= WARN_BEFORE_MS ? Math.ceil(left / 1000) : null);
      }
    }, CHECK_EVERY_MS);
    return () => {
      for (const name of ACTIVITY_EVENTS) {
        window.removeEventListener(name, markActive, { capture: true });
      }
      window.clearInterval(timer);
    };
  }, [idleMs, leave, markActive]);

  if (secondsLeft === null) return null;
  return (
    <div className="z-idle" role="alertdialog" aria-live="assertive" aria-label={labels.stay}>
      <p>{interpolate(labels.warning, { seconds: secondsLeft })}</p>
      <button
        type="button"
        className="z-btn z-btn--primary z-btn--sm"
        onClick={() => {
          last.current = 0;
          markActive();
          ping();
          setSecondsLeft(null);
        }}
      >
        {labels.stay}
      </button>
    </div>
  );
}
