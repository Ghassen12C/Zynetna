import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COVER_TONES, coverToneFor, zelligeDataUri } from '@/lib/brand';

/**
 * The zellige tile lives in TypeScript (for the generated demo images) and in
 * CSS (for the live fallback cover). Two copies of artwork drift, so this
 * fails the moment they differ.
 */
describe('brand artwork', () => {
  it('keeps the CSS cover tile identical to the generated one', () => {
    const css = readFileSync('src/styles/globals.css', 'utf8');
    expect(css).toContain(zelligeDataUri());
    // The hero's ink variant, on the light background.
    expect(css).toContain(zelligeDataUri('#0E3B66', 0.09));
  });

  it('gives a business the same tone every time, from the brand palette only', () => {
    const tone = coverToneFor('barber-el-medina-tunis');
    expect(coverToneFor('barber-el-medina-tunis')).toEqual(tone);
    expect(COVER_TONES).toContainEqual(tone);
  });

  it('spreads businesses across more than one tone', () => {
    const slugs = ['a', 'salon-yasmine', 'hammam-el-andalous', 'atelier-beaute', 'djerba-spa', 'x-y'];
    expect(new Set(slugs.map((s) => coverToneFor(s).join())).size).toBeGreaterThan(1);
  });
});
