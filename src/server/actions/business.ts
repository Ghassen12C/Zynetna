'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { type FeedbackPartKey, invalid, localized, notFound } from '@/lib/errors';
import { requireBusinessAccess } from '@/server/auth/guard';
import { recordAudit } from '@/server/audit';
import { entitlementsFor } from '@/server/services/subscriptions';
import { hhmmToMinutes, minutesToHHMM } from '@/domain/scheduling/time';
import { cuidSchema } from '@/lib/validation/common';
import {
  businessLocationSchema,
  businessPolicySchema,
  businessProfileSchema,
  exceptionSchema,
  hoursSchema,
  serviceSchema,
  staffSchema,
} from '@/lib/validation/business';
import type { FormState } from '@/lib/formState';
import { done, parseForm, toFormState } from './formState';

/**
 * Business management.
 *
 * Every action resolves the tenant through requireBusinessAccess before it
 * touches data, and the businessId is taken from the form only to be checked —
 * never trusted. A nested record (a service, a staff member) is always
 * re-verified as belonging to that same business before it is modified.
 */

function refresh(slug?: string) {
  revalidatePath('/pro/dashboard', 'layout');
  revalidatePath('/pro/preview');
  if (slug) revalidatePath(`/business/${slug}`);
}

export async function updateBusinessProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const businessId = String(formData.get('businessId') ?? '');
  const parsed = await parseForm(businessProfileSchema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const { actor } = await requireBusinessAccess(businessId, 'business.update');

    const updated = await db.business.update({
      where: { id: businessId },
      data: {
        name: parsed.data.name,
        tagline: parsed.data.tagline || null,
        description: parsed.data.description || null,
        story: parsed.data.story || null,
        servedGender: parsed.data.servedGender,
        phone: parsed.data.phone || null,
        whatsapp: parsed.data.whatsapp || null,
        email: parsed.data.email || null,
        website: parsed.data.website || null,
        instagram: parsed.data.instagram || null,
        facebook: parsed.data.facebook || null,
        tiktok: parsed.data.tiktok || null,
      },
      select: { slug: true },
    });

    await recordAudit({
      actor,
      action: 'business.updated',
      targetType: 'Business',
      targetId: businessId,
      businessId,
    });
    refresh(updated.slug);
    return { status: 'success', message: await done('businessSaved') };
  } catch (error) {
    return toFormState(error, 'updateBusinessProfileAction');
  }
}

export async function updateLocationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const businessId = String(formData.get('businessId') ?? '');
  const parsed = await parseForm(businessLocationSchema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const { actor } = await requireBusinessAccess(businessId, 'business.update');

    await db.businessLocation.upsert({
      where: { businessId },
      create: {
        businessId,
        cityId: parsed.data.cityId || null,
        addressLine1: parsed.data.addressLine1,
        addressLine2: parsed.data.addressLine2 || null,
        postalCode: parsed.data.postalCode || null,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        directions: parsed.data.directions || null,
      },
      update: {
        cityId: parsed.data.cityId || null,
        addressLine1: parsed.data.addressLine1,
        addressLine2: parsed.data.addressLine2 || null,
        postalCode: parsed.data.postalCode || null,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        directions: parsed.data.directions || null,
      },
    });

    await recordAudit({
      actor, action: 'business.updated', targetType: 'BusinessLocation',
      targetId: businessId, businessId, metadata: { section: 'location' },
    });
    refresh();
    return { status: 'success', message: await done('addressSaved') };
  } catch (error) {
    return toFormState(error, 'updateLocationAction');
  }
}

export async function updatePolicyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const businessId = String(formData.get('businessId') ?? '');
  // Unchecked checkboxes are simply absent from FormData, so default them.
  const raw = new FormData();
  for (const [k, v] of formData.entries()) raw.append(k, v);
  for (const flag of ['autoConfirm', 'allowCustomerCancel', 'allowCustomerReschedule']) {
    if (!raw.has(flag)) raw.set(flag, 'false');
    else raw.set(flag, 'true');
  }

  const parsed = await parseForm(businessPolicySchema, raw);
  if (!parsed.ok) return parsed.state;

  try {
    const { actor } = await requireBusinessAccess(businessId, 'business.policy.write');

    await db.business.update({
      where: { id: businessId },
      data: {
        autoConfirm: parsed.data.autoConfirm,
        slotGranularityMinutes: parsed.data.slotGranularityMinutes,
        minNoticeMinutes: parsed.data.minNoticeMinutes,
        maxAdvanceDays: parsed.data.maxAdvanceDays,
        cancellationWindowHours: parsed.data.cancellationWindowHours,
        allowCustomerCancel: parsed.data.allowCustomerCancel,
        allowCustomerReschedule: parsed.data.allowCustomerReschedule,
        cancellationPolicy: parsed.data.cancellationPolicy || null,
        noShowPolicy: parsed.data.noShowPolicy || null,
        bookingNotice: parsed.data.bookingNotice || null,
      },
    });

    await recordAudit({
      actor, action: 'business.updated', targetType: 'Business',
      targetId: businessId, businessId, metadata: { section: 'policy' },
    });
    refresh();
    return { status: 'success', message: await done('policySaved') };
  } catch (error) {
    return toFormState(error, 'updatePolicyAction');
  }
}

// ── Services ──────────────────────────────────────────────────────────────

export async function saveServiceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const businessId = String(formData.get('businessId') ?? '');
  const raw = new FormData();
  for (const [k, v] of formData.entries()) raw.append(k, v);
  raw.set('isActive', formData.has('isActive') ? 'true' : 'false');

  const parsed = await parseForm(serviceSchema, raw);
  if (!parsed.ok) return parsed.state;

  try {
    const { actor } = await requireBusinessAccess(businessId, 'business.service.write');
    const data = parsed.data;

    // Plan entitlements are enforced here, not just displayed.
    if (!data.id) {
      const entitlements = await entitlementsFor(businessId);
      if (entitlements.maxServices !== null) {
        const count = await db.service.count({ where: { businessId } });
        if (count >= entitlements.maxServices) {
          throw localized('SUBSCRIPTION_INACTIVE', 'serviceLimit', {
            count: entitlements.maxServices,
          });
        }
      }
    }

    // Staff ids must belong to this business — a posted id from elsewhere is
    // silently dropped rather than linking across tenants.
    const validStaff = await db.staffMember.findMany({
      where: { businessId, id: { in: data.staffIds } },
      select: { id: true },
    });

    let serviceId = data.id;
    if (serviceId) {
      const existing = await db.service.findFirst({
        where: { id: serviceId, businessId },
        select: { id: true },
      });
      if (!existing) throw notFound('serviceNotFound');

      await db.service.update({
        where: { id: serviceId },
        data: {
          name: data.name,
          description: data.description || null,
          categoryId: data.categoryId || null,
          priceAmount: data.priceAmount,
          durationMinutes: data.durationMinutes,
          bufferMinutes: data.bufferMinutes,
          prepMinutes: data.prepMinutes,
          minNoticeMinutes: data.minNoticeMinutes === '' ? null : Number(data.minNoticeMinutes),
          isActive: data.isActive,
        },
      });
    } else {
      const position = await db.service.count({ where: { businessId } });
      const created = await db.service.create({
        data: {
          businessId,
          name: data.name,
          description: data.description || null,
          categoryId: data.categoryId || null,
          priceAmount: data.priceAmount,
          durationMinutes: data.durationMinutes,
          bufferMinutes: data.bufferMinutes,
          prepMinutes: data.prepMinutes,
          minNoticeMinutes: data.minNoticeMinutes === '' ? null : Number(data.minNoticeMinutes),
          isActive: data.isActive,
          position,
        },
        select: { id: true },
      });
      serviceId = created.id;
    }

    await db.staffService.deleteMany({ where: { serviceId } });
    if (validStaff.length > 0) {
      await db.staffService.createMany({
        data: validStaff.map((s) => ({ serviceId: serviceId!, staffMemberId: s.id })),
      });
    }

    await recordAudit({
      actor, action: 'business.updated', targetType: 'Service',
      targetId: serviceId, businessId, metadata: { name: data.name },
    });
    refresh();
    return { status: 'success', message: await done('serviceSaved') };
  } catch (error) {
    return toFormState(error, 'saveServiceAction');
  }
}

export async function deleteServiceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = await parseForm(
    z.object({ businessId: cuidSchema, serviceId: cuidSchema }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const { actor, businessId } = await requireBusinessAccess(
      parsed.data.businessId,
      'business.service.write',
    );

    const service = await db.service.findFirst({
      where: { id: parsed.data.serviceId, businessId },
      select: { id: true, name: true, _count: { select: { items: true } } },
    });
    if (!service) throw notFound('serviceNotFound');

    // A service with history is deactivated, not deleted: removing it would
    // break the reservations that reference it.
    if (service._count.items > 0) {
      await db.service.update({ where: { id: service.id }, data: { isActive: false } });
      refresh();
      return { status: 'success', message: await done('serviceDeactivated') };
    }

    await db.service.delete({ where: { id: service.id } });
    await recordAudit({
      actor, action: 'business.updated', targetType: 'Service',
      targetId: service.id, businessId, metadata: { event: 'deleted', name: service.name },
    });
    refresh();
    return { status: 'success', message: await done('serviceDeleted') };
  } catch (error) {
    return toFormState(error, 'deleteServiceAction');
  }
}

// ── Staff ─────────────────────────────────────────────────────────────────

export async function saveStaffAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const businessId = String(formData.get('businessId') ?? '');
  const raw = new FormData();
  for (const [k, v] of formData.entries()) raw.append(k, v);
  raw.set('isBookable', formData.has('isBookable') ? 'true' : 'false');
  raw.set('isActive', formData.has('isActive') ? 'true' : 'false');

  const parsed = await parseForm(staffSchema, raw);
  if (!parsed.ok) return parsed.state;

  try {
    const { actor } = await requireBusinessAccess(businessId, 'business.staff.write');
    const data = parsed.data;

    if (!data.id) {
      const entitlements = await entitlementsFor(businessId);
      if (entitlements.maxStaff !== null) {
        const count = await db.staffMember.count({ where: { businessId } });
        if (count >= entitlements.maxStaff) {
          throw localized('SUBSCRIPTION_INACTIVE', 'staffLimit', {
            count: entitlements.maxStaff,
          });
        }
      }
    }

    const specialties = (data.specialties || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);

    const validServices = await db.service.findMany({
      where: { businessId, id: { in: data.serviceIds } },
      select: { id: true },
    });

    let staffId = data.id;
    if (staffId) {
      const existing = await db.staffMember.findFirst({
        where: { id: staffId, businessId },
        select: { id: true },
      });
      if (!existing) throw notFound('staffNotFound');

      await db.staffMember.update({
        where: { id: staffId },
        data: {
          displayName: data.displayName,
          title: data.title || null,
          bio: data.bio || null,
          specialties,
          isBookable: data.isBookable,
          isActive: data.isActive,
        },
      });
    } else {
      const position = await db.staffMember.count({ where: { businessId } });
      const created = await db.staffMember.create({
        data: {
          businessId,
          displayName: data.displayName,
          title: data.title || null,
          bio: data.bio || null,
          specialties,
          isBookable: data.isBookable,
          isActive: data.isActive,
          position,
        },
        select: { id: true },
      });
      staffId = created.id;
    }

    await db.staffService.deleteMany({ where: { staffMemberId: staffId } });
    if (validServices.length > 0) {
      await db.staffService.createMany({
        data: validServices.map((s) => ({ staffMemberId: staffId!, serviceId: s.id })),
      });
    }

    await recordAudit({
      actor, action: 'business.updated', targetType: 'StaffMember',
      targetId: staffId, businessId, metadata: { name: data.displayName },
    });
    refresh();
    return { status: 'success', message: await done('staffSaved') };
  } catch (error) {
    return toFormState(error, 'saveStaffAction');
  }
}

export async function deleteStaffAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = await parseForm(
    z.object({ businessId: cuidSchema, staffId: cuidSchema }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const { actor, businessId } = await requireBusinessAccess(
      parsed.data.businessId,
      'business.staff.write',
    );

    const member = await db.staffMember.findFirst({
      where: { id: parsed.data.staffId, businessId },
      select: { id: true, displayName: true },
    });
    if (!member) throw notFound('staffNotFound');

    // Refuse while future appointments exist — deleting would orphan them.
    const upcoming = await db.reservation.count({
      where: {
        staffMemberId: member.id,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startAt: { gte: new Date() },
      },
    });
    if (upcoming > 0) {
      throw invalid('staffHasUpcoming', { name: member.displayName, count: upcoming });
    }

    const past = await db.reservation.count({ where: { staffMemberId: member.id } });
    if (past > 0) {
      await db.staffMember.update({
        where: { id: member.id },
        data: { isActive: false, isBookable: false },
      });
      refresh();
      return { status: 'success', message: await done('staffDeactivated') };
    }

    await db.staffMember.delete({ where: { id: member.id } });
    await recordAudit({
      actor, action: 'business.updated', targetType: 'StaffMember',
      targetId: member.id, businessId, metadata: { event: 'deleted' },
    });
    refresh();
    return { status: 'success', message: await done('staffDeleted') };
  } catch (error) {
    return toFormState(error, 'deleteStaffAction');
  }
}

// ── Hours ─────────────────────────────────────────────────────────────────

export async function saveHoursAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const businessId = String(formData.get('businessId') ?? '');
  const parsed = await parseForm(hoursSchema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const { actor } = await requireBusinessAccess(businessId, 'business.hours.write');
    const { weekday, starts, ends, staffMemberId } = parsed.data;

    const periods: { startMin: number; endMin: number }[] = [];
    for (let i = 0; i < starts.length; i += 1) {
      const start = starts[i]?.trim();
      const end = ends[i]?.trim();
      if (!start || !end) continue;
      const startMin = hhmmToMinutes(start);
      const endMin = hhmmToMinutes(end);
      if (endMin <= startMin) {
        throw invalid('hoursEndBeforeStart', { start, end });
      }
      periods.push({ startMin, endMin });
    }

    // Overlap is rejected by a database constraint too, but catching it here
    // gives the owner a sentence rather than a constraint name.
    periods.sort((a, b) => a.startMin - b.startMin);
    for (let i = 1; i < periods.length; i += 1) {
      if (periods[i]!.startMin < periods[i - 1]!.endMin) {
        throw invalid('hoursOverlap');
      }
    }

    if (staffMemberId) {
      const member = await db.staffMember.findFirst({
        where: { id: staffMemberId, businessId },
        select: { id: true },
      });
      if (!member) throw notFound('staffNotFound');

      await db.$transaction([
        db.staffHours.deleteMany({ where: { staffMemberId, weekday } }),
        db.staffHours.createMany({
          data: periods.map((p) => ({ staffMemberId, weekday, ...p })),
        }),
      ]);
    } else {
      await db.$transaction([
        db.businessHours.deleteMany({ where: { businessId, weekday } }),
        db.businessHours.createMany({
          data: periods.map((p) => ({ businessId, weekday, ...p })),
        }),
      ]);
    }

    await recordAudit({
      actor, action: 'business.updated', targetType: 'BusinessHours',
      targetId: businessId, businessId, metadata: { weekday, periods: periods.length },
    });
    refresh();
    return { status: 'success', message: await done('hoursSaved') };
  } catch (error) {
    return toFormState(error, 'saveHoursAction');
  }
}

export async function addExceptionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const businessId = String(formData.get('businessId') ?? '');
  const parsed = await parseForm(exceptionSchema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const { actor } = await requireBusinessAccess(businessId, 'business.hours.write');
    const data = parsed.data;

    if (data.endDate && data.endDate < data.date) {
      throw invalid('endDateBeforeStart');
    }
    if (
      data.startMin !== '' && data.endMin !== '' && data.startMin !== undefined &&
      data.endMin !== undefined && Number(data.endMin) <= Number(data.startMin)
    ) {
      throw invalid('hoursEndBeforeStart', {
        start: minutesToHHMM(Number(data.startMin)),
        end: minutesToHHMM(Number(data.endMin)),
      });
    }

    await db.scheduleException.create({
      data: {
        businessId,
        staffMemberId: data.staffMemberId || null,
        kind: data.kind,
        date: new Date(`${data.date}T00:00:00Z`),
        endDate: data.endDate ? new Date(`${data.endDate}T00:00:00Z`) : null,
        startMin: data.startMin === '' ? null : Number(data.startMin),
        endMin: data.endMin === '' ? null : Number(data.endMin),
        reason: data.reason || null,
      },
    });

    await recordAudit({
      actor, action: 'business.updated', targetType: 'ScheduleException',
      businessId, metadata: { kind: data.kind, date: data.date },
    });
    refresh();
    return { status: 'success', message: await done('closureSaved') };
  } catch (error) {
    return toFormState(error, 'addExceptionAction');
  }
}

export async function deleteExceptionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = await parseForm(
    z.object({ businessId: cuidSchema, exceptionId: cuidSchema }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const { businessId } = await requireBusinessAccess(
      parsed.data.businessId,
      'business.hours.write',
    );
    // deleteMany with the tenant in the filter: a foreign id simply matches
    // nothing rather than deleting another business's row.
    await db.scheduleException.deleteMany({
      where: { id: parsed.data.exceptionId, businessId },
    });
    refresh();
    return { status: 'success', message: await done('closureDeleted') };
  } catch (error) {
    return toFormState(error, 'deleteExceptionAction');
  }
}

/**
 * Drop a professional's own week, so they work the business's hours again.
 * Owner/manager only (`business.hours.write`); the professional must belong
 * to that business, so a foreign id deletes nothing.
 */
export async function clearStaffHoursAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = await parseForm(
    z.object({ businessId: cuidSchema, staffMemberId: cuidSchema }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const { actor, businessId } = await requireBusinessAccess(
      parsed.data.businessId,
      'business.hours.write',
    );
    const member = await db.staffMember.findFirst({
      where: { id: parsed.data.staffMemberId, businessId },
      select: { id: true },
    });
    if (!member) throw notFound('staffNotFound');

    await db.staffHours.deleteMany({ where: { staffMemberId: member.id } });
    await recordAudit({
      actor, action: 'business.updated', targetType: 'StaffHours',
      targetId: member.id, businessId, metadata: { cleared: true },
    });
    refresh();
    return { status: 'success', message: await done('hoursSaved') };
  } catch (error) {
    return toFormState(error, 'clearStaffHoursAction');
  }
}

// ── Publishing ────────────────────────────────────────────────────────────

/** Submit for review, or publish directly when approval is not required. */
export async function publishBusinessAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = await parseForm(z.object({ businessId: cuidSchema }), formData);
  if (!parsed.ok) return parsed.state;

  try {
    const { actor, businessId } = await requireBusinessAccess(
      parsed.data.businessId,
      'business.publish',
    );

    const business = await db.business.findUniqueOrThrow({
      where: { id: businessId },
      select: {
        status: true, slug: true, description: true,
        location: { select: { id: true } },
        _count: { select: { services: true, staff: true, hours: true } },
      },
    });

    const missing: FeedbackPartKey[] = [];
    if (!business.location) missing.push('missingAddress');
    if (business._count.services === 0) missing.push('missingService');
    if (business._count.staff === 0) missing.push('missingStaff');
    if (business._count.hours === 0) missing.push('missingHours');
    if (missing.length > 0) {
      throw invalid('publishMissing', { items: missing });
    }

    const setting = await db.platformSetting.findUnique({
      where: { key: 'marketplace.requireApproval' },
    });
    const requiresApproval = setting?.value !== false;

    await db.business.update({
      where: { id: businessId },
      data: {
        status: requiresApproval ? 'PENDING_REVIEW' : 'ACTIVE',
        verification: requiresApproval ? 'PENDING' : undefined,
        publishedAt: requiresApproval ? null : new Date(),
      },
    });

    await recordAudit({
      actor, action: 'business.published', targetType: 'Business',
      targetId: businessId, businessId,
    });
    refresh(business.slug);

    return {
      status: 'success',
      message: await done(requiresApproval ? 'submittedForReview' : 'published'),
    };
  } catch (error) {
    return toFormState(error, 'publishBusinessAction');
  }
}
