import { NextResponse } from 'next/server';
import { getActor } from '@/server/auth/session';
import { paymentProofFor } from '@/server/services/payments';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payments/:id/proof — the screenshot of a D17 payment.
 * Who: a platform admin, or a member of the business allowed to read its
 * subscription (business.subscription.read). Anyone else, signed in or not,
 * gets 404, so the route never confirms that a payment exists.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { id } = await context.params;
  try {
    const body = await paymentProofFor(id, actor);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        'content-type': 'image/webp',
        // Private: never cached by a shared cache or kept by the browser.
        'cache-control': 'private, no-store',
        'content-disposition': 'inline',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
