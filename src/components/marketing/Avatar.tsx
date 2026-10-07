'use client';

import { useEffect, useRef, useState } from 'react';
import {
  type AvatarState,
  autoSettleMs,
  nextState,
} from '@/domain/avatar/states';

export type AvatarCopy = {
  ariaLabel: string;
  greeting: string;
  greetingBody: string;
};

/**
 * The Zynetna host — a Tunisian in a chechia who welcomes the visitor.
 *
 * This is brand, not decoration, and it is meant to grow into a voice
 * concierge, so the figure renders a state from `@/domain/avatar/states`
 * rather than a couple of local booleans. Today the page drives it through
 * IDLE → GREETING → SPEAKING → IDLE; tomorrow a voice loop can drive the same
 * machine through LISTENING and THINKING without the artwork changing.
 *
 * Deliberately inline SVG on CSS keyframes rather than a 3D scene or a Lottie
 * payload: roughly 4 KB, no network request, no WebGL context and no
 * main-thread animation loop. The whole sequence is transform and opacity
 * only, so it composites on the GPU and cannot thrash layout on a mid-range
 * Android phone on Tunisian 4G.
 *
 * Two rules it must never break. It yields completely to
 * `prefers-reduced-motion`, where the figure simply appears in its final pose.
 * And it never blocks the interface: the whole thing is `pointer-events: none`
 * so a visitor who has no interest in the host can search straight past it.
 */
export function WelcomeAvatar({
  copy,
  state: controlled,
  className,
}: {
  copy: AvatarCopy;
  /** Set by a future voice loop. Left out, the avatar greets and settles. */
  state?: AvatarState;
  className?: string;
}) {
  const [state, setState] = useState<AvatarState>('IDLE');
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = controlled ?? state;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Only animate once the figure is actually on screen.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // The welcome: greet on arrival, speak, then settle into idle. Skipped
  // entirely when the page is driven from outside.
  useEffect(() => {
    if (!visible || controlled) return;
    setState((s) => nextState(s, 'GREETING'));
  }, [visible, controlled]);

  useEffect(() => {
    if (controlled) return;
    const hold = autoSettleMs(state);
    if (hold === null) return;
    const timer = window.setTimeout(() => {
      setState((s) => nextState(s, 'IDLE'));
    }, hold);
    return () => window.clearTimeout(timer);
  }, [state, controlled]);

  const speaking = active === 'GREETING' || active === 'SPEAKING';

  return (
    <div
      ref={ref}
      // The state is a data attribute so every pose lives in CSS, which is
      // also what lets `prefers-reduced-motion` switch the whole thing off in
      // one place.
      data-state={active}
      className={`z-avatar ${visible ? 'is-visible' : ''} ${className ?? ''}`}
    >
      {/* The host's own words. Real text in the DOM, so a screen reader and a
          search engine both get the greeting, and polite so it never
          interrupts what the visitor is already doing. */}
      <p className="z-avatar__bubble" aria-live="polite" data-shown={speaking}>
        <strong>{copy.greeting}</strong>
        <span>{copy.greetingBody}</span>
      </p>

      <svg
        viewBox="0 0 260 320"
        role="img"
        aria-label={copy.ariaLabel}
        className="z-avatar__svg"
      >
        <defs>
          <clipPath id="z-av-body">
            <path d="M58 320v-66c0-40 32-62 72-62s72 22 72 62v66Z" />
          </clipPath>
          <linearGradient id="z-av-chechia" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C9333B" />
            <stop offset="100%" stopColor="#9E232B" />
          </linearGradient>
        </defs>

        {/* Soft ground shadow, so the figure sits rather than floats */}
        <ellipse className="z-avatar__ground" cx="130" cy="306" rx="78" ry="12" fill="var(--z-medina)" opacity="0.08" />

        <g className="z-avatar__figure">
          {/* Torso — a barber's jacket in Medina Blue */}
          <path d="M58 320v-66c0-40 32-62 72-62s72 22 72 62v66Z" fill="var(--z-medina)" />
          <path d="M130 192 110 320h40L130 192Z" fill="var(--z-chaux)" opacity="0.18" clipPath="url(#z-av-body)" />
          {/* Collar */}
          <path d="M112 196l18 22 18-22-18-10-18 10Z" fill="var(--z-chaux)" opacity="0.9" />

          {/* Neck */}
          <rect x="118" y="160" width="24" height="36" rx="11" fill="#D9A273" />

          {/* Head */}
          <ellipse cx="130" cy="124" rx="46" ry="50" fill="#E8B788" />
          {/* Ears */}
          <ellipse cx="84" cy="128" rx="8" ry="11" fill="#D9A273" />
          <ellipse cx="176" cy="128" rx="8" ry="11" fill="#D9A273" />

          {/* Beard and moustache — a barber's own grooming */}
          <path
            d="M88 126c0 34 19 54 42 54s42-20 42-54c0 22-19 30-42 30s-42-8-42-30Z"
            fill="#2F2419"
          />
          <path d="M116 142h28c0 6-6 9-14 9s-14-3-14-9Z" fill="#2F2419" />

          {/* Eyes — these blink */}
          <g className="z-avatar__eyes">
            <ellipse cx="112" cy="118" rx="5.5" ry="6.5" fill="#20304A" />
            <ellipse cx="148" cy="118" rx="5.5" ry="6.5" fill="#20304A" />
          </g>
          {/* Brows */}
          <path d="M103 104c5-4 13-4 18-1" stroke="#2F2419" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M139 103c5-3 13-3 18 1" stroke="#2F2419" strokeWidth="4" strokeLinecap="round" fill="none" />
          {/* Smile */}
          <path
            className="z-avatar__smile"
            d="M116 136c4 6 24 6 28 0"
            stroke="#8A4A32"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* The chechia — the Tunisian signature */}
          <path d="M86 98c0-26 20-44 44-44s44 18 44 44c0 4-2 6-6 6H92c-4 0-6-2-6-6Z" fill="url(#z-av-chechia)" />
          <rect x="82" y="96" width="96" height="12" rx="6" fill="#8E1E26" />
          {/* Tassel */}
          <circle cx="130" cy="50" r="7" fill="#7E1A21" />

          {/* Resting arm, tucked against the body */}
          <path
            d="M72 226 60 288"
            stroke="var(--z-medina)"
            strokeWidth="26"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="58" cy="294" r="15" fill="#E8B788" />

          {/* The waving arm. Drawn as a stroked path so the limb reads as an
              arm rather than a rectangle, and pivots cleanly at the shoulder. */}
          <g className="z-avatar__arm">
            <path
              d="M190 226 221 164"
              stroke="var(--z-medina)"
              strokeWidth="26"
              strokeLinecap="round"
              fill="none"
            />
            {/* Open palm, fingers up — the offered hand */}
            <circle cx="226" cy="152" r="18" fill="#E8B788" />
            <path
              d="M214 142v-14M223 138v-18M232 140v-15M240 146v-11"
              stroke="#E8B788"
              strokeWidth="7"
              strokeLinecap="round"
            />
          </g>
        </g>

        {/* Jasmin greeting sparks, timed to the wave */}
        <g className="z-avatar__sparks" aria-hidden="true">
          <circle cx="250" cy="126" r="4" fill="var(--z-jasmin)" />
          <circle cx="258" cy="152" r="3" fill="var(--z-jasmin)" />
          <circle cx="240" cy="104" r="2.5" fill="var(--z-jasmin)" />
        </g>
      </svg>
    </div>
  );
}
