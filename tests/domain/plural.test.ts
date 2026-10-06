import { describe, expect, it } from 'vitest';
import { formatCount } from '@/i18n/format';
import { ar } from '@/i18n/messages/ar';
import { en } from '@/i18n/messages/en';
import { fr } from '@/i18n/messages/fr';

/**
 * Arabic distinguishes singular, dual, 3–10 and 11+. Picking the wrong form is
 * not a cosmetic slip: "2 مؤسسة" reads as broken Arabic to a native speaker.
 */
describe('plural forms', () => {
  it('uses French singular and plural', () => {
    expect(formatCount(fr.home.businessCount, 1, 'fr')).toBe('1 établissement');
    expect(formatCount(fr.home.businessCount, 7, 'fr')).toBe('7 établissements');
  });

  it('uses English singular and plural', () => {
    expect(formatCount(en.home.businessCount, 1, 'en')).toBe('1 place');
    expect(formatCount(en.home.businessCount, 7, 'en')).toBe('7 places');
  });

  it('picks the Arabic dual for exactly two', () => {
    expect(formatCount(ar.home.businessCount, 2, 'ar')).toBe('مؤسستان');
  });

  it('picks the Arabic singular, few and many forms', () => {
    expect(formatCount(ar.home.businessCount, 1, 'ar')).toBe('مؤسسة واحدة');
    // 3–10 take the broken plural.
    expect(formatCount(ar.home.businessCount, 5, 'ar')).toContain('مؤسسات');
    // 11+ return to the singular noun after the numeral.
    expect(formatCount(ar.home.businessCount, 20, 'ar')).toContain('مؤسسة');
  });

  it('falls back to `other` when a locale omits a category', () => {
    // French has no dual; Intl asks for `other` and finds it.
    expect(formatCount(fr.home.businessCount, 2, 'fr')).toBe('2 établissements');
  });
});
