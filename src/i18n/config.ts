/**
 * Lightweight i18n.
 *
 * Three locales do not justify a framework: this gives typed keys, parameter
 * interpolation, correct RTL and locale-aware number/date/currency formatting
 * in a few hundred bytes of runtime, with no dependency.
 */
export const LOCALES = ['fr', 'ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

export const LOCALE_META: Record<
  Locale,
  { label: string; nativeLabel: string; dir: 'ltr' | 'rtl'; intl: string }
> = {
  fr: { label: 'French', nativeLabel: 'Français', dir: 'ltr', intl: 'fr-TN' },
  ar: { label: 'Arabic', nativeLabel: 'العربية', dir: 'rtl', intl: 'ar-TN' },
  en: { label: 'English', nativeLabel: 'English', dir: 'ltr', intl: 'en' },
};

/**
 * A countable message, one entry per CLDR plural category.
 *
 * French and English need two forms; Arabic needs up to six, and picking the
 * wrong one is not a cosmetic slip — "2 مؤسسة" reads as broken Arabic. `other`
 * is the only required form so every locale has a safe fallback, and each one
 * declares exactly the categories its grammar uses.
 */
export type PluralForms = {
  other: string;
} & Partial<Record<'zero' | 'one' | 'two' | 'few' | 'many', string>>;

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function dirOf(locale: Locale): 'ltr' | 'rtl' {
  return LOCALE_META[locale].dir;
}

/** Best match from an Accept-Language header. */
export function negotiateLocale(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag = '', q = 'q=1'] = part.trim().split(';');
      return { tag: tag.toLowerCase().split('-')[0] ?? '', q: Number(q.replace('q=', '')) || 0 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    if (isLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}
