/**
 * Interval algebra over minutes-from-midnight. Pure arithmetic, no dates —
 * which is what keeps the slot engine easy to reason about and fast to test.
 */

export type Interval = { start: number; end: number };

export function isValid(i: Interval): boolean {
  return Number.isFinite(i.start) && Number.isFinite(i.end) && i.end > i.start;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function contains(outer: Interval, inner: Interval): boolean {
  return inner.start >= outer.start && inner.end <= outer.end;
}

/** Sort and merge touching or overlapping intervals. */
export function normalise(intervals: Interval[]): Interval[] {
  const valid = intervals.filter(isValid).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const current of valid) {
    const last = out[out.length - 1];
    if (last && current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      out.push({ ...current });
    }
  }
  return out;
}

/** Everything in `base` that is not covered by any interval in `cuts`. */
export function subtract(base: Interval[], cuts: Interval[]): Interval[] {
  const blocked = normalise(cuts);
  let remaining = normalise(base);

  for (const cut of blocked) {
    const next: Interval[] = [];
    for (const piece of remaining) {
      if (!overlaps(piece, cut)) {
        next.push(piece);
        continue;
      }
      if (piece.start < cut.start) next.push({ start: piece.start, end: cut.start });
      if (piece.end > cut.end) next.push({ start: cut.end, end: piece.end });
    }
    remaining = next;
  }
  return remaining;
}

/** The parts covered by both sets. */
export function intersect(a: Interval[], b: Interval[]): Interval[] {
  const left = normalise(a);
  const right = normalise(b);
  const out: Interval[] = [];
  for (const x of left) {
    for (const y of right) {
      const start = Math.max(x.start, y.start);
      const end = Math.min(x.end, y.end);
      if (end > start) out.push({ start, end });
    }
  }
  return normalise(out);
}

export function totalMinutes(intervals: Interval[]): number {
  return normalise(intervals).reduce((sum, i) => sum + (i.end - i.start), 0);
}
