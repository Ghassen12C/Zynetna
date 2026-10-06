'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The Zynetna welcome avatar — a Tunisian host in a chechia who greets the
 * visitor and offers a hand.
 *
 * Deliberately inline SVG driven by CSS keyframes rather than a 3D scene or a
 * Lottie payload: it is roughly 4 KB, costs no network request, no WebGL
 * context and no main-thread animation loop, and the whole sequence is
 * transform/opacity only — so it composites on the GPU and cannot cause
 * layout thrash on a mid-range Android phone on a Tunisian 4G connection.
 *
 * It yields completely to `prefers-reduced-motion`, where the figure simply
 * appears in its final pose.
 */
export function WelcomeAvatar({ className }: { className?: string }) {
  const [entered, setEntered] = useState(false);
  const [waved, setWaved] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Animate only once the figure is actually on screen.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setEntered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!entered) return;
    const timer = window.setTimeout(() => setWaved(true), 700);
    return () => window.clearTimeout(timer);
  }, [entered]);

  return (
    <div
      ref={ref}
      className={`z-avatar ${entered ? 'is-entered' : ''} ${waved ? 'is-waving' : ''} ${className ?? ''}`}
    >
      <svg viewBox="0 0 260 320" role="img" aria-label="Un hôte tunisien vous souhaite la bienvenue" className="z-avatar__svg">
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
