import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { ingestImage } from '../src/server/services/media';

/**
 * Generate cover, interior and portfolio images for the seeded businesses.
 *
 * These are composed here and then pushed through the *real* ingest pipeline
 * (`ingestImage`), so the seed also exercises magic-byte sniffing, sharp
 * re-encoding, variant generation and storage writes. The marketplace then
 * shows genuine stored objects rather than CSS placeholders.
 */
const db = new PrismaClient();

/** On-brand only: Medina Blue, Jasmin, Encre and Slate. No stray hues. */
const PALETTES = [
  ['#0E3B66', '#246A9F'], // Medina
  ['#E0A94E', '#B57F2C'], // Jasmin
  ['#0A1C2E', '#16507F'], // Encre → Medina
  ['#44566B', '#7FA8C8'], // Slate
  ['#07213A', '#0E3B66'], // deep Medina
  ['#C9913A', '#E0A94E'], // warm Jasmin
];

/** Business names can contain &, <, > — SVG is XML, so escape before embedding. */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** A branded abstract composition — arches, bands and a soft wash. */
async function compose(seed: number, label: string, width = 1280, height = 960) {
  const [from, to] = PALETTES[seed % PALETTES.length]!;
  const r = (n: number) => ((seed * 9301 + n * 49297) % 233280) / 233280;

  const arches = Array.from({ length: 5 }, (_, i) => {
    const w = 120 + r(i) * 190;
    const x = r(i + 10) * width - w / 2;
    const y = height - (90 + r(i + 20) * 420);
    const opacity = (0.06 + r(i + 30) * 0.14).toFixed(3);
    return `<path d="M${x} ${y + w} v-${w / 2} a${w / 2} ${w / 2} 0 0 1 ${w} 0 v${w / 2} z" fill="#F5F1E8" opacity="${opacity}"/>`;
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${from}"/>
        <stop offset="100%" stop-color="${to}"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
    ${arches}
    <rect x="0" y="${height - 6}" width="${width}" height="6" fill="#E0A94E"/>
    <text x="${width / 2}" y="${height - 46}" font-family="sans-serif" font-size="26"
          font-weight="600" fill="#F5F1E8" opacity="0.42" text-anchor="middle"
          letter-spacing="7">${xmlEscape(label)}</text>
  </svg>`;

  // Emit a real JPEG so the ingest pipeline sees genuine image bytes.
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
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

  for (const [index, business] of businesses.entries()) {
    const label = business.name.toUpperCase().slice(0, 20);
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
        const buffer = await compose(
          variantSeed,
          item.role === 'LOGO' ? 'Z' : label,
          square ? 600 : 1280,
          square ? 600 : 960,
        );
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
      const buffer = await compose(variantSeed, service.name.toUpperCase().slice(0, 18), 800, 600);
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
