import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { db } from '@/lib/db';
import { invalid, localized } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { checksumOf, storage } from '../providers/storage';

/**
 * Image ingest pipeline.
 *
 * Every uploaded file is validated server-side and re-encoded before it is
 * stored. Re-encoding is the security control that matters: a polyglot file
 * with a PHP payload or a crafted EXIF block does not survive a decode and
 * re-encode through sharp, and the stored object is a byte sequence we
 * produced ourselves rather than one the uploader chose.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_PIXELS = 50_000_000; // reject decompression bombs
const MIN_DIMENSION = 32;

/** Formats accepted for upload. SVG is excluded: it is a script host. */
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

/** Magic-byte signatures — the declared Content-Type is never trusted. */
function sniff(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  const riff = buffer.subarray(0, 4).toString('ascii');
  const webp = buffer.subarray(8, 12).toString('ascii');
  if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp';
  const ftyp = buffer.subarray(4, 8).toString('ascii');
  if (ftyp === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (brand.startsWith('avif') || brand.startsWith('avis')) return 'image/avif';
  }
  return null;
}

export type Variant = 'thumb' | 'card' | 'full';

const SIZES: Record<Variant, number> = { thumb: 320, card: 640, full: 1280 };

export type UploadResult = {
  id: string;
  storageKey: string;
  url: string;
  width: number;
  height: number;
  variants: Record<string, string>;
};

export type UploadInput = {
  buffer: Buffer;
  filename: string;
  declaredType: string;
  uploadedById: string;
  /** Groups objects in storage, e.g. `business/<id>`. */
  prefix: string;
  alt?: string | null;
};

export async function ingestImage(input: UploadInput): Promise<UploadResult> {
  if (input.buffer.length === 0) throw invalid('fileEmpty');
  if (input.buffer.length > MAX_UPLOAD_BYTES) {
    throw localized('PAYLOAD_TOO_LARGE', 'fileTooLarge', {
      size: Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024),
    });
  }

  // The real content type, from the bytes themselves.
  const actualType = sniff(input.buffer);
  if (!actualType || !ACCEPTED.has(actualType)) {
    throw localized('UNSUPPORTED_MEDIA', 'unsupportedImage');
  }
  // A mismatch between the declared and actual type is a red flag worth logging.
  if (input.declaredType && input.declaredType !== actualType) {
    logger.warn('upload content-type mismatch', {
      declared: input.declaredType,
      actual: actualType,
      uploadedById: input.uploadedById,
    });
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input.buffer, { limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    throw localized('UNSUPPORTED_MEDIA', 'unreadableImage');
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    throw invalid('imageTooSmall', { size: MIN_DIMENSION });
  }
  if (width * height > MAX_PIXELS) {
    throw localized('PAYLOAD_TOO_LARGE', 'imageTooLargeToProcess');
  }

  const id = randomBytes(12).toString('hex');
  const base = `${input.prefix}/${id}`;
  const variants: Record<string, string> = {};

  // Re-encode into modern formats at three widths. `withoutEnlargement` keeps
  // a small source from being upscaled into a blurry "full".
  for (const [variant, size] of Object.entries(SIZES) as [Variant, number][]) {
    for (const format of ['avif', 'webp'] as const) {
      const pipeline = sharp(input.buffer, { limitInputPixels: MAX_PIXELS })
        .rotate() // honour EXIF orientation before the data is stripped
        .resize(size, size, { fit: 'inside', withoutEnlargement: true });

      const body =
        format === 'avif'
          ? await pipeline.avif({ quality: 55, effort: 4 }).toBuffer()
          : await pipeline.webp({ quality: 78 }).toBuffer();

      const key = `${base}/${variant}.${format}`;
      await storage.put(key, body, `image/${format}`);
      variants[`${variant}.${format}`] = key;
    }
  }

  // A JPEG fallback for clients without AVIF/WebP support.
  const fallback = await sharp(input.buffer, { limitInputPixels: MAX_PIXELS })
    .rotate()
    .resize(SIZES.full, SIZES.full, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, progressive: true })
    .toBuffer();
  const fallbackKey = `${base}/full.jpg`;
  await storage.put(fallbackKey, fallback, 'image/jpeg');
  variants['full.jpg'] = fallbackKey;

  const asset = await db.mediaAsset.create({
    data: {
      storageKey: fallbackKey,
      mimeType: 'image/jpeg',
      width,
      height,
      bytes: input.buffer.length,
      checksum: checksumOf(input.buffer),
      variants: variants as object,
      alt: input.alt ?? null,
      uploadedById: input.uploadedById,
    },
  });

  return {
    id: asset.id,
    storageKey: fallbackKey,
    url: storage.url(fallbackKey),
    width,
    height,
    variants,
  };
}

/** Public URL for a variant, falling back to the stored original. */
export function variantUrl(
  asset: { storageKey: string; variants: unknown },
  variant: Variant = 'card',
  format: 'avif' | 'webp' | 'jpg' = 'webp',
): string {
  const map = (asset.variants ?? {}) as Record<string, string>;
  const key = map[`${variant}.${format}`] ?? map['full.jpg'] ?? asset.storageKey;
  return storage.url(key);
}

/** Delete an asset and every stored variant. */
export async function deleteAsset(assetId: string): Promise<void> {
  const asset = await db.mediaAsset.findUnique({
    where: { id: assetId },
    select: { id: true, storageKey: true, variants: true },
  });
  if (!asset) return;

  const keys = new Set<string>([asset.storageKey]);
  for (const key of Object.values((asset.variants ?? {}) as Record<string, string>)) {
    keys.add(key);
  }
  await Promise.all([...keys].map((k) => storage.delete(k).catch(() => undefined)));
  await db.mediaAsset.delete({ where: { id: asset.id } }).catch(() => undefined);
}
