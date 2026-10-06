/**
 * Interpolate `{name}` placeholders.
 *
 * Its own module so both `format.ts` and `index.ts` can use it without the two
 * importing each other.
 */
export function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}
