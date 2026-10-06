/**
 * Hand-built SVG charts.
 *
 * A charting library would add roughly 180 KB to a dashboard that needs two
 * chart types. These are a couple of KB, render on the server with no
 * hydration, and read correctly in both themes because they use the same
 * tokens as everything else.
 */

export type Point = { label: string; value: number };

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

/** Area + line chart for a time series. */
export function TrendChart({
  points,
  height = 180,
  format = (n: number) => String(n),
  label,
}: {
  points: Point[];
  height?: number;
  format?: (n: number) => string;
  label: string;
}) {
  if (points.length === 0) {
    return <p className="z-chart__empty">Pas encore de données.</p>;
  }

  const width = 640;
  const padding = { top: 12, right: 8, bottom: 22, left: 36 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const max = niceMax(Math.max(...points.map((p) => p.value)));

  const x = (i: number) =>
    padding.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => padding.top + plotH - (v / max) * plotH;

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${padding.top + plotH} L${x(0).toFixed(1)},${padding.top + plotH} Z`;

  // Label only a few ticks, so the axis stays readable at any series length.
  const tickEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <figure className="z-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(max * fraction)}
              y2={y(max * fraction)}
              stroke="var(--z-border)"
              strokeWidth="1"
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

        <path d={area} fill="var(--z-medina-100)" opacity="0.7" />
        <path
          d={line}
          fill="none"
          stroke="var(--z-accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

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
