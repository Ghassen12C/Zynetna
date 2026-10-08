import { db } from '@/lib/db';
import { invalid } from '@/lib/errors';

/**
 * Packs (wedding, engagement, henna night…) are ordinary services with a
 * fixed price that bundle other services of the same business. They are
 * booked, scheduled and confirmed through the same engine as any service.
 */

/**
 * The services a pack may bundle, in the order the owner ticked them.
 *
 * Only regular services of this same business qualify: another business's
 * service, another pack, or the pack itself is dropped, never linked across
 * tenants. Fewer than two survivors is refused, since a pack of one is just
 * the service.
 */
export async function resolvePackItems(
  businessId: string,
  packageId: string | null,
  wanted: string[],
): Promise<string[]> {
  const candidates = [...new Set(wanted)].filter((id) => id !== packageId);
  const rows = await db.service.findMany({
    where: { businessId, id: { in: candidates }, isPackage: false },
    select: { id: true },
  });
  const allowed = new Set(rows.map((r) => r.id));
  const included = candidates.filter((id) => allowed.has(id));
  if (included.length < 2) throw invalid('packNeedsServices');
  return included;
}

/** Replaces what a pack bundles, atomically. Ids must come from resolvePackItems. */
export async function setPackItems(packageId: string, serviceIds: string[]) {
  await db.$transaction([
    db.servicePackageItem.deleteMany({ where: { packageId } }),
    db.servicePackageItem.createMany({
      data: serviceIds.map((serviceId, position) => ({ packageId, serviceId, position })),
    }),
  ]);
}
