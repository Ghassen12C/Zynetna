/**
 * Hand-built SVG charts.
 *
 * A charting library would add roughly 180 KB to a dashboard that needs two
 * chart types. These are a couple of KB, render on the server with no
 * hydration, and read correctly in both themes because they use the same
 * tokens as everything else.
 */

import { stableHash } from '@/lib/brand';

export type Point = { label: string; value: number };

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

/**
 * A smooth path through the points that never overshoots them.
 *
 * Monotone cubic interpolation (Fritsch–Carlson): a plain spline would bulge
 * past the data and draw peaks and dips that never happened — a dashboard
 * must not invent a busy Tuesday. Built in screen space, which preserves
 * monotonicity under the y-axis flip.
 */
export function monotonePath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n === 1) return `M${xs[0]!.toFixed(1)},${ys[0]!.toFixed(1)}`;

  const d = Array.from({ length: n - 1 }, (_, k) => (ys[k + 1]! - ys[k]!) / (xs[k + 1]! - xs[k]!));
  const m = Array.from({ length: n }, (_, k) => {
    if (k === 0) return d[0]!;
    if (k === n - 1) return d[n - 2]!;
    return d[k - 1]! * d[k]! <= 0 ? 0 : (d[k - 1]! + d[k]!) / 2;
  });
  for (let k = 0; k < n - 1; k += 1) {
    if (d[k] === 0) {
      m[k] = 0;
      m[k + 1] = 0;
      continue;
    }
    const a = m[k]! / d[k]!;
    const b = m[k + 1]! / d[k]!;
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[k] = t * a * d[k]!;
      m[k + 1] = t * b * d[k]!;
    }
  }

  let path = `M${xs[0]!.toFixed(1)},${ys[0]!.toFixed(1)}`;
  for (let k = 0; k < n - 1; k += 1) {
    const h = (xs[k + 1]! - xs[k]!) / 3;
    path += ` C${(xs[k]! + h).toFixed(1)},${(ys[k]! + m[k]! * h).toFixed(1)} ${(xs[k + 1]! - h).toFixed(1)},${(ys[k + 1]! - m[k + 1]! * h).toFixed(1)} ${xs[k + 1]!.toFixed(1)},${ys[k + 1]!.toFixed(1)}`;
  }
  return path;
}

/** A stable id for SVG defs, since this renders on the server without hooks. */
function idFor(label: string): string {
  return `zc${stableHash(label).toString(36)}`;
}

/** Area + line chart for a time series. */
export function TrendChart({
  points,
  height = 180,
  format = (n: number) => String(n),
  label,
  emptyLabel = 'Pas encore de données.',
}: {
  points: Point[];
  height?: number;
  format?: (n: number) => string;
  label: string;
  emptyLabel?: string;
}) {
  if (points.length === 0) {
    return <p className="z-chart__empty">{emptyLabel}</p>;
  }

  const width = 640;
  const padding = { top: 14, right: 16, bottom: 22, left: 36 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const max = niceMax(Math.max(...points.map((p) => p.value)));

  const x = (i: number) =>
    padding.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => padding.top + plotH - (v / max) * plotH;

  const xs = points.map((_, i) => x(i));
  const ys = points.map((p) => y(p.value));
  const line = monotonePath(xs, ys);
  const area = `${line} L${xs[xs.length - 1]!.toFixed(1)},${padding.top + plotH} L${xs[0]!.toFixed(1)},${padding.top + plotH} Z`;
  const gradient = idFor(label);
  const last = points.length - 1;

  // Label only a few ticks, so the axis stays readable at any series length.
  const tickEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <figure className="z-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="z-chart__svg">
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--z-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--z-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(max * fraction)}
              y2={y(max * fraction)}
              stroke="var(--z-border)"
              strokeWidth="1"
              strokeDasharray={fraction === 0 ? undefined : '3 5'}
            />
            <text
              x={padding.left - 6}
              y={y(max * fraction) + 4}
              textAnchor="end"
              fontSize="10"
              fill="var(--z-fg-subtle)"
            >
              {format(Math.round(max * fraction))}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#${gradient})`} className="z-chart__area" />
        {/* pathLength normalises the length, so the draw-in needs no measuring. */}
        <path
          d={line}
          pathLength={1}
          fill="none"
          stroke="var(--z-accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="z-chart__line"
        />
        {/* The most recent value is the one an owner looks for first. */}
        <g className="z-chart__now">
          <circle cx={xs[last]} cy={ys[last]} r="9" fill="var(--z-accent)" opacity="0.14" />
          <circle cx={xs[last]} cy={ys[last]} r="4.5" fill="var(--z-bg-raised)" stroke="var(--z-accent)" strokeWidth="2.5" />
        </g>

        {points.map((p, i) =>
          i % tickEvery === 0 || i === points.length - 1 ? (
            <text
              key={p.label}
              x={x(i)}
              y={height - 6}
              textAnchor="middle"
              fontSize="10"
              fill="var(--z-fg-subtle)"
            >
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="z-sr-only">{label}</figcaption>
    </figure>
  );
}

/** Horizontal bars for a ranked list — reads better than a pie for top-N. */
export function BarList({
  points,
  format = (n: number) => String(n),
  emptyLabel = 'Pas encore de données.',
}: {
  points: Point[];
  format?: (n: number) => string;
  emptyLabel?: string;
}) {
  if (points.length === 0) return <p className="z-chart__empty">{emptyLabel}</p>;
  const max = Math.max(...points.map((p) => p.value), 1);

  return (
    <ul className="z-barlist">
      {points.map((point) => (
        <li key={point.label}>
          <span className="z-barlist__label" title={point.label}>
            {point.label}
          </span>
          <span className="z-barlist__track">
            <span style={{ width: `${(point.value / max) * 100}%` }} />
          </span>
          <span className="z-barlist__value">{format(point.value)}</span>
        </li>
      ))}
    </ul>
  );
}
