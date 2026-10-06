'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AppError, invalid, notFound } from '@/lib/errors';
import { requireBusinessAccess } from '@/server/auth/guard';
import { consume } from '@/server/rateLimit';
import { recordAudit } from '@/server/audit';
import { MAX_UPLOAD_BYTES, deleteAsset, ingestImage } from '@/server/services/media';
import { entitlementsFor } from '@/server/services/subscriptions';
import { cuidSchema } from '@/lib/validation/common';
import type { FormState } from '@/lib/formState';
import { toFormState } from './formState';

const ROLES = ['LOGO', 'COVER', 'EXTERIOR', 'INTERIOR', 'PORTFOLIO', 'TEAM', 'GALLERY'] as const;

/**
 * Upload business media.
 *
 * Validation lives in ingestImage (magic-byte sniffing, size, dimensions,
 * re-encoding). This action's job is authorization, plan limits and the
 * attachment record.
 */
export async function uploadBusinessMediaAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const businessId = String(formData.get('businessId') ?? '');
    const role = String(formData.get('role') ?? 'GALLERY');
    if (!ROLES.includes(role as (typeof ROLES)[number])) throw invalid('Type d’image inconnu.');

    const { actor } = await requireBusinessAccess(businessId, 'business.media.manage');
    await consume('mediaUpload', actor.userId);

    const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) throw invalid('Choisissez au moins une image.');
    if (files.length > 10) throw invalid('10 images maximum à la fois.');

    const entitlements = await entitlementsFor(businessId);
    if (entitlements.maxGalleryImages !== null) {
      const existing = await db.businessMedia.count({ where: { businessId } });
      if (existing + files.length > entitlements.maxGalleryImages) {
        throw new AppError(
          'SUBSCRIPTION_INACTIVE',
          `Votre formule est limitée à ${entitlements.maxGalleryImages} photos (${existing} déjà utilisées).`,
        );
      }
    }

    // Logo and cover are singular: a new one replaces the old, including its
    // stored objects, so orphans do not accumulate.
    const singular = role === 'LOGO' || role === 'COVER';
    if (singular) {
      const previous = await db.businessMedia.findMany({
        where: { businessId, role: role as (typeof ROLES)[number] },
        select: { id: true, assetId: true },
      });
      for (const item of previous) {
        await db.businessMedia.delete({ where: { id: item.id } }).catch(() => undefined);
        await deleteAsset(item.assetId);
      }
    }

    let position = singular
      ? 0
      : await db.businessMedia.count({ where: { businessId, role: role as (typeof ROLES)[number] } });

    for (const file of files.slice(0, singular ? 1 : files.length)) {
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new AppError(
          'PAYLOAD_TOO_LARGE',
          `« ${file.name} » dépasse ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} Mo.`,
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const asset = await ingestImage({
        buffer,
        filename: file.name,
        declaredType: file.type,
        uploadedById: actor.userId,
        prefix: `business/${businessId}`,
        alt: null,
      });
      await db.businessMedia.create({
        data: {
          businessId,
          assetId: asset.id,
          role: role as (typeof ROLES)[number],
          position: position++,
        },
      });
    }

    await recordAudit({
      actor, action: 'business.updated', targetType: 'BusinessMedia',
      businessId, metadata: { role, count: files.length },
    });

    revalidatePath('/pro/dashboard', 'layout');
    revalidatePath('/pro/preview');
    return { status: 'success', message: `${files.length} image(s) ajoutée(s).` };
  } catch (error) {
    return toFormState(error, 'uploadBusinessMediaAction');
  }
}

export async function deleteBusinessMediaAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const parsed = z
      .object({ businessId: cuidSchema, mediaId: cuidSchema })
      .parse({
        businessId: formData.get('businessId'),
        mediaId: formData.get('mediaId'),
      });

    const { actor, businessId } = await requireBusinessAccess(
      parsed.businessId,
      'business.media.manage',
    );

    const media = await db.businessMedia.findFirst({
      where: { id: parsed.mediaId, businessId },
      select: { id: true, assetId: true, role: true },
    });
    if (!media) throw notFound('Image introuvable.');

    await db.businessMedia.delete({ where: { id: media.id } });
    await deleteAsset(media.assetId);

    await recordAudit({
      actor, action: 'media.deleted', targetType: 'BusinessMedia',
      targetId: media.id, businessId, metadata: { role: media.role },
    });

    revalidatePath('/pro/dashboard', 'layout');
    revalidatePath('/pro/preview');
    return { status: 'success', message: 'Image supprimée.' };
  } catch (error) {
    return toFormState(error, 'deleteBusinessMediaAction');
  }
}

/** Persist a drag-reordered gallery. */
export async function reorderBusinessMediaAction(
  businessId: string,
  orderedIds: string[],
): Promise<FormState> {
  try {
    const { actor } = await requireBusinessAccess(businessId, 'business.media.manage');

    const owned = await db.businessMedia.findMany({
      where: { businessId, id: { in: orderedIds } },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((m) => m.id));

    await db.$transaction(
      orderedIds
        .filter((id) => ownedIds.has(id))
        .map((id, index) =>
          db.businessMedia.update({ where: { id }, data: { position: index } }),
        ),
    );

    await recordAudit({
      actor, action: 'business.updated', targetType: 'BusinessMedia',
      businessId, metadata: { event: 'reordered' },
    });

    revalidatePath('/pro/dashboard/gallery');
    revalidatePath('/pro/preview');
    return { status: 'success' };
  } catch (error) {
    return toFormState(error, 'reorderBusinessMediaAction');
  }
}

/** Attach an image to a single service. */
export async function uploadServiceMediaAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const businessId = String(formData.get('businessId') ?? '');
    const serviceId = String(formData.get('serviceId') ?? '');
    const { actor } = await requireBusinessAccess(businessId, 'business.media.manage');
    await consume('mediaUpload', actor.userId);

    const service = await db.service.findFirst({
      where: { id: serviceId, businessId },
      select: { id: true },
    });
    if (!service) throw notFound('Prestation introuvable.');

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) throw invalid('Choisissez une image.');

    // One image per service: replace rather than accumulate.
    const previous = await db.serviceMedia.findMany({
      where: { serviceId },
      select: { id: true, assetId: true },
    });
    for (const item of previous) {
      await db.serviceMedia.delete({ where: { id: item.id } }).catch(() => undefined);
      await deleteAsset(item.assetId);
    }

    const asset = await ingestImage({
      buffer: Buffer.from(await file.arrayBuffer()),
      filename: file.name,
      declaredType: file.type,
      uploadedById: actor.userId,
      prefix: `business/${businessId}/services`,
      alt: null,
    });
    await db.serviceMedia.create({ data: { serviceId, assetId: asset.id, position: 0 } });

    revalidatePath('/pro/dashboard/services');
    revalidatePath('/pro/preview');
    return { status: 'success', message: 'Image enregistrée.' };
  } catch (error) {
    return toFormState(error, 'uploadServiceMediaAction');
  }
}

/** Attach a photo to a staff member. */
export async function uploadStaffAvatarAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const businessId = String(formData.get('businessId') ?? '');
    const staffId = String(formData.get('staffId') ?? '');
    const { actor } = await requireBusinessAccess(businessId, 'business.staff.write');
    await consume('mediaUpload', actor.userId);

    const member = await db.staffMember.findFirst({
      where: { id: staffId, businessId },
      select: { id: true, avatarId: true },
    });
    if (!member) throw notFound('Membre introuvable.');

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) throw invalid('Choisissez une image.');

    const asset = await ingestImage({
      buffer: Buffer.from(await file.arrayBuffer()),
      filename: file.name,
      declaredType: file.type,
      uploadedById: actor.userId,
      prefix: `business/${businessId}/staff`,
      alt: null,
    });

    await db.staffMember.update({ where: { id: member.id }, data: { avatarId: asset.id } });
    if (member.avatarId) await deleteAsset(member.avatarId);

    revalidatePath('/pro/dashboard/team');
    revalidatePath('/pro/preview');
    return { status: 'success', message: 'Photo enregistrée.' };
  } catch (error) {
    return toFormState(error, 'uploadStaffAvatarAction');
  }
}
