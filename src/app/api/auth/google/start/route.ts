import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { env, isProd } from '@/lib/env';
import { safeRedirect } from '@/server/auth/landing';
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_MAX_AGE,
  beginGoogleSignIn,
  encodePending,
  googleEnabled,
} from '@/server/auth/google';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/google/start — send the visitor to Google's account chooser.
 * Public. Stores the state, PKCE verifier and nonce of this attempt in a
 * short-lived HttpOnly cookie that only the callback reads.
 */
export async function GET(request: Request) {
  if (!googleEnabled()) return NextResponse.redirect(new URL('/login', env.APP_URL));

  const requested = new URL(request.url).searchParams.get('redirectTo');
  const redirectTo = requested ? safeRedirect(requested, '') || null : null;
  const { url, pending } = beginGoogleSignIn(redirectTo);

  (await cookies()).set(OAUTH_COOKIE, encodePending(pending), {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/auth/google',
    maxAge: OAUTH_COOKIE_MAX_AGE,
  });
  return NextResponse.redirect(url);
}
