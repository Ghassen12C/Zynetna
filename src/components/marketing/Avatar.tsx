'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import {
  type AvatarState,
  autoSettleMs,
  nextState,
} from '@/domain/avatar/states';
import { type HostCue, onHostCue } from '@/lib/hostBus';

export type AvatarCopy = {
  ariaLabel: string;
  greeting: string;
  greetingBody: string;
  /** Shown while the visitor is in the search field. */
  listening: string;
  /** Shown while a search they submitted is loading. */
  thinking: string;
};

/** Split a line into words so they can arrive one after another, like speech. */
function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(' ').map((word, i) => (
        // The space sits outside the span: a trailing space inside an
        // inline-block collapses and would run the words together.
        <Fragment key={i}>
          <span className="z-avatar__word" style={{ ['--w' as string]: i }}>
            {word}
          </span>{' '}
        </Fragment>
      ))}
    </>
  );
}

/** How far, in SVG units, the pupils may travel toward the pointer. */
const GAZE = 3.2;

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
  const [line, setLine] = useState<NonNullable<HostCue['line']>>('greeting');
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = controlled ?? state;

  // The interface cues the host; the state machine decides whether the cue
  // is a legal move, so nothing outside can make it claim a booking.
  useEffect(() => {
    if (controlled) return;
    return onHostCue((cue) => {
      setState((current) => {
        const next = nextState(current, cue.state);
        if (next === cue.state) {
          // Settling returns him to his welcome; other cues carry their line.
          if (cue.state === 'IDLE') setLine('greeting');
          else if (cue.line) setLine(cue.line);
        }
        return next;
      });
    });
  }, [controlled]);

  // A search that never navigates (same query, offline) must not leave the
  // host looking busy forever.
  useEffect(() => {
    if (controlled || active !== 'THINKING') return;
    const timer = window.setTimeout(() => setState((s) => nextState(s, 'IDLE')), 5000);
    return () => window.clearTimeout(timer);
  }, [active, controlled]);

  // The host looks toward the visitor: the pupils follow the pointer a few
  // units. Written straight to CSS variables, so a mouse move costs one style
  // write per frame and no React render. Skipped on touch screens, where
  // there is no pointer to follow, and when motion is unwelcome.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let px = 0;
    let py = 0;
    const apply = () => {
      frame = 0;
      const box = node.getBoundingClientRect();
      // Eyes sit about a third of the way down the figure.
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height * 0.36;
      const dx = px - cx;
      const dy = py - cy;
      const distance = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, distance / 420);
      node.style.setProperty('--gx', `${((dx / distance) * GAZE * reach).toFixed(2)}px`);
      node.style.setProperty('--gy', `${((dy / distance) * GAZE * 0.7 * reach).toFixed(2)}px`);
    };
    const onMove = (event: PointerEvent) => {
      px = event.clientX;
      py = event.clientY;
      if (!frame) frame = window.requestAnimationFrame(apply);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

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

  // His line stays up once he has said it: it is the page's invitation, and a
  // host standing beside an empty space after four seconds reads as broken.
  // It only waits for the figure to arrive before appearing.
  const speaking = visible;
  const shownLine = active === 'GREETING' || active === 'IDLE' ? 'greeting' : line;

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
        {/* Keyed on the line, so the words replay whenever the host says
            something new. */}
        {shownLine === 'greeting' ? (
          <span key="greeting">
            <strong>
              <Words text={copy.greeting} />
            </strong>
            <span className="z-avatar__sub">
              <Words text={copy.greetingBody} />
            </span>
          </span>
        ) : (
          <span key={shownLine} className="z-avatar__sub z-avatar__sub--solo">
            <Words text={shownLine === 'listening' ? copy.listening : copy.thinking} />
          </span>
        )}
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

          {/* Cheeks — they warm when he is pleased (greeting, success). */}
          <g className="z-avatar__cheeks">
            <ellipse cx="101" cy="139" rx="8" ry="5" fill="#E0796A" />
            <ellipse cx="159" cy="139" rx="8" ry="5" fill="#E0796A" />
          </g>

          {/* Eyes. The outer group blinks; the inner one follows the pointer,
              so the two motions never fight over one transform. */}
          <g className="z-avatar__eyes">
            <g className="z-avatar__gaze">
              <ellipse cx="112" cy="118" rx="5.5" ry="6.5" fill="#20304A" />
              <ellipse cx="148" cy="118" rx="5.5" ry="6.5" fill="#20304A" />
              {/* Catchlights: the smallest detail that makes eyes look alive. */}
              <circle cx="114" cy="115.5" r="1.7" fill="#FFFFFF" opacity="0.85" />
              <circle cx="150" cy="115.5" r="1.7" fill="#FFFFFF" opacity="0.85" />
            </g>
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
            {/* The open hand — its own group, so it can come forward
                (scale up, as if toward the viewer) when offered to shake. */}
            <g className="z-avatar__hand">
              <circle cx="226" cy="152" r="18" fill="#E8B788" />
              <path
                d="M214 142v-14M223 138v-18M232 140v-15M240 146v-11"
                stroke="#E8B788"
                strokeWidth="7"
                strokeLinecap="round"
              />
            </g>
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
