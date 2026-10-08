import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { isPrivateKey, storage } from '@/server/providers/storage';

/**
 * Serves objects from the local storage driver in development.
 *
 * In production `STORAGE_DRIVER=azure` returns absolute Blob/CDN URLs and this
 * route is never reached — which is why it refuses to run when the local
 * driver is not the one in use, rather than becoming a second, unaudited read
 * path into object storage.
 */
const CONTENT_TYPES: Record<string, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  if (env.STORAGE_DRIVER !== 'local') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  const { key } = await context.params;
  const path = key.join('/');
  // Private objects have their own, authorised routes; never this public one.
  if (isPrivateKey(path)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) {
    return NextResponse.json({ error: 'Unsupported media type' }, { status: 415 });
  }

  try {
    const body = await storage.get(path);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': contentType,
        // Keys are content-addressed, so objects never change under a key.
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
