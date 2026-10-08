import { NextResponse } from 'next/server';
import { getActor } from '@/server/auth/session';
import { d17QrImage } from '@/server/services/payments';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payments/d17-qr — the platform's D17 QR code, to pay a
 * subscription. Who: any signed-in person (the subscription page is only
 * shown to business owners; the QR is not secret, but it is not published
 * to the open web either).
 */
export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const body = await d17QrImage(actor);
    return new NextResponse(new Uint8Array(body), {
      headers: { 'content-type': 'image/webp', 'cache-control': 'private, max-age=300' },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
