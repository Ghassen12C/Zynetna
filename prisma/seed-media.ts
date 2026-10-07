import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { ingestImage } from '../src/server/services/media';
import { COVER_TONES, ZELLIGE_TILE, zelligeTile } from '../src/lib/brand';

/**
 * Generate cover, interior and portfolio images for the seeded businesses.
 *
 * These are composed here and then pushed through the *real* ingest pipeline
 * (`ingestImage`), so the seed also exercises magic-byte sniffing, sharp
 * re-encoding, variant generation and storage writes. The marketplace then
 * shows genuine stored objects rather than CSS placeholders.
 */
const db = new PrismaClient();

/**
 * A branded stand-in for a photograph: the business's gradient, a soft light
 * from one corner, the zellige lattice from `src/lib/brand.ts`, and one tall
 * medina doorway — the shape of the Zynetna mark — so a gallery of these still
 * reads as one house. The tile is the same one the interface uses for covers.
 */
async function compose(seed: number, width = 1280, height = 960) {
  const [from, to] = COVER_TONES[seed % COVER_TONES.length]!;
  const r = (n: number) => ((seed * 9301 + n * 49297) % 233280) / 233280;

  // Vary scale and strength per image so a gallery is not twelve copies.
  const tile = Math.round(ZELLIGE_TILE * (0.9 + r(1) * 0.9));
  const opacity = (0.1 + r(2) * 0.1).toFixed(3);
  const inner = zelligeTile('#F5F1E8', Number(opacity)).replace(/^<svg[^>]*>|<\/svg>$/g, '');

  // One doorway, off-centre, rising from the bottom edge.
  const dw = width * (0.22 + r(3) * 0.12);
  const dx = r(4) > 0.5 ? width * (0.62 + r(5) * 0.16) : width * (0.06 + r(5) * 0.14);
  const dh = height * (0.58 + r(6) * 0.2);
  const dy = height - dh;
  const door = `M${dx} ${height} V${dy + dw / 2} A${dw / 2} ${dw / 2} 0 0 1 ${dx + dw} ${dy + dw / 2} V${height} Z`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${from}"/>
        <stop offset="100%" stop-color="${to}"/>
      </linearGradient>
      <radialGradient id="light" cx="0.15" cy="0" r="1">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.18"/>
        <stop offset="60%" stop-color="#FFFFFF" stop-opacity="0"/>
      </radialGradient>
      <pattern id="z" width="${ZELLIGE_TILE}" height="${ZELLIGE_TILE}" patternUnits="userSpaceOnUse"
               patternTransform="scale(${(tile / ZELLIGE_TILE).toFixed(3)})">${inner}</pattern>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
    <rect width="${width}" height="${height}" fill="url(#z)"/>
    <rect width="${width}" height="${height}" fill="url(#light)"/>
    <path d="${door}" fill="#F5F1E8" opacity="0.1"/>
    <path d="${door}" fill="none" stroke="#F5F1E8" stroke-opacity="0.22" stroke-width="2"/>
    <rect x="0" y="${height - 6}" width="${width}" height="6" fill="#E0A94E"/>
  </svg>`;

  // Emit a real JPEG so the ingest pipeline sees genuine image bytes.
  return sharp(Buffer.from(svg)).jpeg({ quality: 86 }).toBuffer();
}

async function main() {
  const businesses = await db.business.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, slug: true, ownerId: true, services: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Generating media for ${businesses.length} businesses…`);
  await db.businessMedia.deleteMany();
  await db.serviceMedia.deleteMany();
  // Detaching leaves the assets orphaned; drop them so a reseed does not
  // accumulate unreferenced objects.
  const orphaned = await db.mediaAsset.deleteMany({
    where: {
      businessMedia: { none: {} },
      serviceMedia: { none: {} },
      reviewMedia: { none: {} },
      staffAvatars: { none: {} },
      userAvatars: { none: {} },
    },
  });
  if (orphaned.count > 0) console.log(`Removed ${orphaned.count} orphaned assets.`);

  for (const [index, business] of businesses.entries()) {
    const plan: { role: 'LOGO' | 'COVER' | 'EXTERIOR' | 'INTERIOR' | 'PORTFOLIO'; n: number }[] = [
      { role: 'COVER', n: 1 },
      { role: 'LOGO', n: 1 },
      { role: 'EXTERIOR', n: 1 },
      { role: 'INTERIOR', n: 3 },
      { role: 'PORTFOLIO', n: 4 },
    ];

    let variantSeed = index * 17;
    for (const item of plan) {
      for (let i = 0; i < item.n; i += 1) {
        variantSeed += 1;
        const square = item.role === 'LOGO';
        const buffer = await compose(variantSeed, square ? 600 : 1280, square ? 600 : 960);
        const asset = await ingestImage({
          buffer,
          filename: `${business.slug}-${item.role.toLowerCase()}-${i}.jpg`,
          declaredType: 'image/jpeg',
          uploadedById: business.ownerId,
          prefix: `business/${business.id}`,
          alt: `${business.name} — ${item.role.toLowerCase()}`,
        });
        await db.businessMedia.create({
          data: { businessId: business.id, assetId: asset.id, role: item.role, position: i },
        });
      }
    }

    // One image per service.
    for (const [sIndex, service] of business.services.entries()) {
      variantSeed += 1;
      const buffer = await compose(variantSeed, 800, 600);
      const asset = await ingestImage({
        buffer,
        filename: `${service.id}.jpg`,
        declaredType: 'image/jpeg',
        uploadedById: business.ownerId,
        prefix: `business/${business.id}/services`,
        alt: service.name,
      });
      await db.serviceMedia.create({
        data: { serviceId: service.id, assetId: asset.id, position: sIndex },
      });
    }

    process.stdout.write(`  ${business.slug}\n`);
  }

  const total = await db.mediaAsset.count();
  console.log(`\nDone — ${total} media assets stored.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
