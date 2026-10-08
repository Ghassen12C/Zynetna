/** Send people where their work is. */
export function landingFor(roles: string[]): string {
  return roles.includes('SUPER_ADMIN')
    ? '/admin'
    : roles.includes('BUSINESS_OWNER') || roles.includes('BUSINESS_EMPLOYEE')
      ? '/pro/dashboard'
      : '/account';
}

/** Only allow redirects to our own paths — never an absolute URL from a form. */
export function safeRedirect(target: string | undefined | null, fallback: string): string {
  if (!target) return fallback;
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return fallback;
  return target;
}
