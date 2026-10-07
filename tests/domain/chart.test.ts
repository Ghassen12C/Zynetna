import { describe, expect, it } from 'vitest';
import { monotonePath } from '@/components/charts/Charts';

/** Sample every cubic segment of a path and return the y range it covers. */
function segments(path: string) {
  const start = path.match(/^M([\d.-]+),([\d.-]+)/)!;
  let y0 = Number(start[2]);
  const out: { y0: number; y1: number; min: number; max: number }[] = [];
  for (const c of path.matchAll(/C([\d.-]+),([\d.-]+) ([\d.-]+),([\d.-]+) ([\d.-]+),([\d.-]+)/g)) {
    const [, , c1y, , c2y, , y3] = c.map(Number);
    let min = Infinity;
    let max = -Infinity;
    for (let t = 0; t <= 1; t += 0.02) {
      const u = 1 - t;
      const y = u * u * u * y0 + 3 * u * u * t * c1y! + 3 * u * t * t * c2y! + t * t * t * y3!;
      min = Math.min(min, y);
      max = Math.max(max, y);
    }
    out.push({ y0, y1: y3!, min, max });
    y0 = y3!;
  }
  return out;
}

/**
 * A dashboard must not invent a busy day. A plain spline bulges past its
 * points; the monotone curve has to stay inside every pair of neighbours.
 */
describe('trend chart curve', () => {
  it('never overshoots the data on any segment', () => {
    const xs = Array.from({ length: 30 }, (_, i) => i * 20);
    // Spiky, the shape that makes ordinary splines overshoot: 0,4,0,0,3,0…
    const ys = [100, 20, 100, 100, 40, 100, 60, 60, 20, 100, 100, 80, 20, 20, 100, 0, 100, 50, 50, 50, 10, 90, 90, 30, 100, 100, 70, 20, 100, 60];
    for (const seg of segments(monotonePath(xs, ys))) {
      const lo = Math.min(seg.y0, seg.y1) - 0.2;
      const hi = Math.max(seg.y0, seg.y1) + 0.2;
      expect(seg.min).toBeGreaterThanOrEqual(lo);
      expect(seg.max).toBeLessThanOrEqual(hi);
    }
  });

  it('stays flat across a flat run', () => {
    const segs = segments(monotonePath([0, 10, 20, 30], [50, 50, 50, 50]));
    expect(segs.every((s) => s.min >= 49.9 && s.max <= 50.1)).toBe(true);
  });

  it('handles a single point', () => {
    expect(monotonePath([10], [20])).toBe('M10.0,20.0');
  });
});
