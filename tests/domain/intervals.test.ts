import { describe, expect, it } from 'vitest';
import {
  contains,
  intersect,
  normalise,
  overlaps,
  subtract,
  totalMinutes,
} from '@/domain/scheduling/intervals';

describe('interval algebra', () => {
  it('merges overlapping and touching intervals', () => {
    expect(
      normalise([
        { start: 540, end: 660 },
        { start: 600, end: 780 },
        { start: 780, end: 840 },
      ]),
    ).toEqual([{ start: 540, end: 840 }]);
  });

  it('drops invalid intervals', () => {
    expect(normalise([{ start: 600, end: 600 }, { start: 700, end: 600 }])).toEqual([]);
  });

  it('treats adjacency as non-overlapping', () => {
    expect(overlaps({ start: 0, end: 30 }, { start: 30, end: 60 })).toBe(false);
    expect(overlaps({ start: 0, end: 31 }, { start: 30, end: 60 })).toBe(true);
  });

  it('subtracts a cut from the middle, leaving two pieces', () => {
    expect(
      subtract([{ start: 540, end: 1140 }], [{ start: 780, end: 840 }]),
    ).toEqual([
      { start: 540, end: 780 },
      { start: 840, end: 1140 },
    ]);
  });

  it('subtracts a full cover, leaving nothing', () => {
    expect(subtract([{ start: 540, end: 660 }], [{ start: 500, end: 700 }])).toEqual([]);
  });

  it('intersects two sets', () => {
    expect(
      intersect(
        [{ start: 540, end: 1140 }],
        [
          { start: 600, end: 700 },
          { start: 900, end: 1200 },
        ],
      ),
    ).toEqual([
      { start: 600, end: 700 },
      { start: 900, end: 1140 },
    ]);
  });

  it('reports containment and totals', () => {
    expect(contains({ start: 540, end: 1140 }, { start: 600, end: 700 })).toBe(true);
    expect(contains({ start: 540, end: 1140 }, { start: 500, end: 700 })).toBe(false);
    expect(totalMinutes([{ start: 540, end: 780 }, { start: 840, end: 1140 }])).toBe(540);
  });
});
