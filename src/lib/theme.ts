/**
 * The colour theme is the visitor's choice, never the system setting: light
 * unless they switched to dark with the header toggle. Kept in a cookie so the
 * server renders the right theme on the first byte — no flash, no script.
 */
export const THEME_COOKIE = 'zynetna_theme';

export type Theme = 'light' | 'dark';

export function themeFrom(value: string | undefined | null): Theme {
  return value === 'dark' ? 'dark' : 'light';
}

/** The browser chrome colour (mobile address bar) for each theme. */
export const THEME_COLOR: Record<Theme, string> = { light: '#F5F1E8', dark: '#08192B' };
