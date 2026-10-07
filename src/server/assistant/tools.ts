import 'server-only';
import { z } from 'zod';
import type { Actor } from '@/domain/identity/actor';
import { AppError, forbidden, invalid, notFound } from '@/lib/errors';
import { dayKeyOf } from '@/domain/scheduling/time';
import { cuidSchema, dayKeySchema } from '@/lib/validation/common';
import {
  listCities,
  searchBusinesses,
  topCategories,
} from '@/server/services/marketplace';
import { getBusinessProfile } from '@/server/services/businessProfile';
import { getDayAvailability } from '@/server/services/availability';
import {
  cancelAsCustomer,
  createReservation,
  rescheduleAsCustomer,
} from '@/server/services/booking';
import { upcomingReservations } from '@/server/services/account';

/**
 * The concierge tool surface.
 *
 * This is the only way a future AI assistant touches Zynetna. Every entry is
 * a named, schema-validated function that delegates to the same application
 * services the web UI uses, so the assistant inherits the real rules for free:
 * tenant isolation, the booking window, the subscription gate and the
 * exclusion constraint that makes double-booking impossible.
 *
 * Three rules hold, and the tests in `tests/integration/assistant.test.ts`
 * enforce them rather than trusting this comment:
 *
 *   1. No tool reaches the database. There is deliberately no `db` import in
 *      this file. A model that can emit arbitrary arguments must not be one
 *      `where` clause away from the data.
 *   2. No tool decides whether a slot is free. `getAvailability` reports what
 *      the scheduling engine computed, and `createReservation` re-validates
 *      server-side and refuses anything the engine did not offer — so a
 *      hallucinated time becomes a clean error, never an appointment.
 *   3. Booking is never implicit. `createReservation` requires `confirmed:
 *      true`, which the caller may only set after the human has agreed out
 *      loud. A model that forgets gets a refusal telling it to ask first.
 *
 * Everything is plain JSON in and out: no Prisma models, no Date objects, no
 * Decimals. A tool result has to survive being serialised into a prompt.
 */

/** Who the assistant is acting for. Anonymous visitors may only browse. */
export type AssistantContext = {
  actor: Actor | null;
  /** Locale for anything the tool returns that a human will hear. */
  locale: 'fr' | 'ar' | 'en';
};

export type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; /** Does asking again help? */ retriable: boolean };

function ok<T>(data: T): ToolResult<T> {
  return { ok: true, data };
}

function fail(code: string, message: string, retriable = false): ToolResult<never> {
  return { ok: false, code, message, retriable };
}

/** Anything thrown below the tool layer becomes a result, never an exception. */
function toResult(error: unknown): ToolResult<never> {
  if (error instanceof AppError) {
    // SLOT_UNAVAILABLE is the one a conversation can recover from by offering
    // another time, so it is explicitly marked retriable.
    return fail(error.code, error.message, error.code === 'SLOT_UNAVAILABLE');
  }
  return fail('INTERNAL', 'Something went wrong on our side.', true);
}

function requireActor(ctx: AssistantContext): Actor {
  if (!ctx.actor) throw forbidden('Sign-in is required for this.');
  return ctx.actor;
}

/* ───────────────────────── Discovery ───────────────────────── */

const searchInput = z.object({
  query: z.string().trim().max(120).optional(),
  categorySlug: z.string().trim().max(80).optional(),
  citySlug: z.string().trim().max(80).optional(),
  minRating: z.number().min(0).max(5).optional(),
  maxPrice: z.number().positive().max(100000).optional(),
  servedGender: z.enum(['WOMEN', 'MEN', 'EVERYONE']).optional(),
  openNow: z.boolean().optional(),
  // Coordinates let "near me" work; they come from the browser, never the model.
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  // Capped low on purpose: a spoken answer cannot read out twenty salons.
  limit: z.number().int().min(1).max(8).optional(),
});

export type SearchBusinessesInput = z.infer<typeof searchInput>;

async function searchBusinessesTool(ctx: AssistantContext, raw: unknown) {
  const input = searchInput.parse(raw);
  try {
    const result = await searchBusinesses({
      q: input.query,
      categorySlug: input.categorySlug,
      citySlug: input.citySlug,
      minRating: input.minRating,
      maxPrice: input.maxPrice,
      servedGender: input.servedGender,
      openNow: input.openNow,
      lat: input.lat,
      lng: input.lng,
      sort: input.lat != null && input.lng != null ? 'distance' : 'relevance',
      perPage: input.limit ?? 5,
      page: 1,
    });

    return ok({
      total: result.total,
      businesses: result.businesses.map((b) => ({
        slug: b.slug,
        name: b.name,
        tagline: b.tagline ?? null,
        city: b.cityName ?? null,
        category: b.categoryName ?? null,
        rating: b.ratingAverage,
        reviewCount: b.ratingCount,
        fromPrice: b.fromPrice ?? null,
        verified: b.verified,
        distanceKm: b.distanceKm ?? null,
      })),
    });
  } catch (error) {
    return toResult(error);
  }
}

async function listCategoriesTool(_ctx: AssistantContext, _raw: unknown) {
  try {
    const categories = await topCategories(24);
    return ok(
      categories.map((c) => ({
        slug: c.slug,
        name: c.name,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        businessCount: c.count,
      })),
    );
  } catch (error) {
    return toResult(error);
  }
}

async function listCitiesTool(_ctx: AssistantContext, _raw: unknown) {
  try {
    const cities = await listCities();
    return ok(cities.map((c) => ({ slug: c.slug, name: c.name, nameAr: c.nameAr })));
  } catch (error) {
    return toResult(error);
  }
}

const slugInput = z.object({ slug: z.string().trim().min(1).max(140) });

async function getBusinessTool(_ctx: AssistantContext, raw: unknown) {
  const { slug } = slugInput.parse(raw);
  try {
    const business = await getBusinessProfile(slug);
    if (!business) return fail('NOT_FOUND', 'No such business.');

    return ok({
      slug: business.slug,
      name: business.name,
      tagline: business.tagline,
      bookable: business.bookable,
      phone: business.phone,
      currency: business.currency,
      timezone: business.timezone,
      rating: business.ratingAverage,
      reviewCount: business.reviewCount,
      address: business.location
        ? {
            line1: business.location.addressLine1,
            city: business.location.city?.name ?? null,
            cityAr: business.location.city?.nameAr ?? null,
          }
        : null,
      services: business.services.map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        durationMinutes: s.durationMinutes,
      })),
      staff: business.staff.map((p) => ({
        id: p.id,
        name: p.displayName,
        title: p.title,
      })),
      policy: {
        minNoticeMinutes: business.minNoticeMinutes,
        cancellationWindowHours: business.cancellationWindowHours,
        allowCustomerCancel: business.allowCustomerCancel,
        allowCustomerReschedule: business.allowCustomerReschedule,
      },
    });
  } catch (error) {
    return toResult(error);
  }
}

/* ───────────────────────── Availability ───────────────────────── */

const availabilityInput = z.object({
  businessSlug: z.string().trim().min(1).max(140),
  serviceId: cuidSchema,
  staffMemberId: cuidSchema.nullish(),
  day: dayKeySchema,
});

/**
 * What the engine says is free. The assistant reports this; it never computes
 * or guesses availability, and it has no way to.
 */
async function getAvailabilityTool(_ctx: AssistantContext, raw: unknown) {
  const input = availabilityInput.parse(raw);
  try {
    const business = await getBusinessProfile(input.businessSlug);
    if (!business) return fail('NOT_FOUND', 'No such business.');
    if (!business.bookable) {
      return fail('BUSINESS_UNAVAILABLE', 'This business is not taking bookings.');
    }

    const availability = await getDayAvailability({
      businessId: business.id,
      serviceId: input.serviceId,
      staffMemberId: input.staffMemberId ?? null,
      day: input.day,
    });

    return ok({
      day: availability.day,
      isOpen: availability.isOpen,
      closedReason: availability.closedReason ?? null,
      slots: availability.slots.map((s) => ({
        time: s.time,
        startAt: s.startAt.toISOString(),
        staffMemberIds: s.staffMemberIds,
      })),
    });
  } catch (error) {
    return toResult(error);
  }
}

/* ───────────────────────── Booking ───────────────────────── */

const createInput = z.object({
  businessSlug: z.string().trim().min(1).max(140),
  serviceId: cuidSchema,
  staffMemberId: cuidSchema,
  /** Must be one of the instants `getAvailability` returned. */
  startAt: z.string().datetime(),
  customerNote: z.string().trim().max(500).optional(),
  /**
   * The human said yes.
   *
   * A voice flow is easy to misread, so an unconfirmed call is refused rather
   * than booked optimistically — the cost of a wrong booking falls on a salon
   * holding a chair for someone who never agreed to come.
   */
  confirmed: z.literal(true, {
    message: 'Ask the customer to confirm, then call again.',
  }),
});

async function createReservationTool(ctx: AssistantContext, raw: unknown) {
  const parsed = createInput.safeParse(raw);
  if (!parsed.success) {
    const confirmIssue = parsed.error.issues.find((i) => i.path[0] === 'confirmed');
    if (confirmIssue) return fail('NOT_CONFIRMED', confirmIssue.message);
    return fail('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid arguments.');
  }
  const input = parsed.data;

  try {
    const actor = requireActor(ctx);
    const business = await getBusinessProfile(input.businessSlug);
    if (!business) return fail('NOT_FOUND', 'No such business.');

    // `createReservation` re-reads availability and holds an advisory lock, so
    // a start time the engine never offered is rejected here rather than
    // becoming a double booking.
    const reservation = await createReservation({
      businessId: business.id,
      serviceId: input.serviceId,
      staffMemberId: input.staffMemberId,
      startAt: new Date(input.startAt),
      customerId: actor.userId,
      customerNote: input.customerNote ?? null,
      channel: 'ONLINE',
    });

    return ok({
      reference: reservation.reference,
      status: reservation.status,
      startAt: reservation.startAt.toISOString(),
      endAt: reservation.endAt.toISOString(),
      businessName: business.name,
    });
  } catch (error) {
    return toResult(error);
  }
}

const cancelInput = z.object({
  reservationId: cuidSchema,
  reason: z.string().trim().max(300).optional(),
  confirmed: z.literal(true, {
    message: 'Ask the customer to confirm the cancellation first.',
  }),
});

async function cancelReservationTool(ctx: AssistantContext, raw: unknown) {
  const parsed = cancelInput.safeParse(raw);
  if (!parsed.success) {
    const confirmIssue = parsed.error.issues.find((i) => i.path[0] === 'confirmed');
    if (confirmIssue) return fail('NOT_CONFIRMED', confirmIssue.message);
    return fail('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid arguments.');
  }

  try {
    const actor = requireActor(ctx);
    // Ownership and the cancellation window are the service's business, not
    // the assistant's.
    await cancelAsCustomer(parsed.data.reservationId, actor, parsed.data.reason);
    return ok({ cancelled: true });
  } catch (error) {
    return toResult(error);
  }
}

const rescheduleInput = z.object({
  reservationId: cuidSchema,
  startAt: z.string().datetime(),
  staffMemberId: cuidSchema.optional(),
  confirmed: z.literal(true, {
    message: 'Ask the customer to confirm the new time first.',
  }),
});

async function rescheduleReservationTool(ctx: AssistantContext, raw: unknown) {
  const parsed = rescheduleInput.safeParse(raw);
  if (!parsed.success) {
    const confirmIssue = parsed.error.issues.find((i) => i.path[0] === 'confirmed');
    if (confirmIssue) return fail('NOT_CONFIRMED', confirmIssue.message);
    return fail('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid arguments.');
  }

  try {
    const actor = requireActor(ctx);
    const moved = await rescheduleAsCustomer({
      reservationId: parsed.data.reservationId,
      actor,
      startAt: new Date(parsed.data.startAt),
      staffMemberId: parsed.data.staffMemberId,
    });
    return ok({
      reference: moved.reference,
      startAt: moved.startAt.toISOString(),
      status: moved.status,
    });
  } catch (error) {
    return toResult(error);
  }
}

async function myReservationsTool(ctx: AssistantContext, _raw: unknown) {
  try {
    const actor = requireActor(ctx);
    const rows = await upcomingReservations(actor);
    return ok(
      rows.map((r) => ({
        id: r.id,
        reference: r.reference,
        status: r.status,
        startAt: r.startAt.toISOString(),
        businessName: r.business.name,
        businessSlug: r.business.slug,
        serviceName: r.items[0]?.serviceName ?? null,
        staffName: r.staffMember.displayName,
        // The local day, so the assistant can say "tomorrow" correctly.
        day: dayKeyOf(r.business.timezone, r.startAt),
      })),
    );
  } catch (error) {
    return toResult(error);
  }
}

/* ───────────────────────── Registry ───────────────────────── */

export type AssistantTool = {
  name: string;
  /** One line, written for a model deciding whether to call it. */
  description: string;
  /** True when the tool changes something, so a UI can show it differently. */
  mutates: boolean;
  /** True when an anonymous visitor may call it. */
  public: boolean;
  schema: z.ZodType;
  run: (ctx: AssistantContext, input: unknown) => Promise<ToolResult<unknown>>;
};

/**
 * Every capability the concierge has. A model is given exactly this list and
 * nothing else; adding a capability is a deliberate entry here, not an
 * emergent consequence of a prompt.
 */
export const ASSISTANT_TOOLS: readonly AssistantTool[] = [
  {
    name: 'searchBusinesses',
    description:
      'Find salons, barbers, spas and wellness centres by text, category, city, price, rating, or near given coordinates.',
    mutates: false,
    public: true,
    schema: searchInput,
    run: searchBusinessesTool,
  },
  {
    name: 'listCategories',
    description: 'List the service categories available on the marketplace.',
    mutates: false,
    public: true,
    schema: z.object({}),
    run: listCategoriesTool,
  },
  {
    name: 'listCities',
    description: 'List the Tunisian cities that have businesses on the marketplace.',
    mutates: false,
    public: true,
    schema: z.object({}),
    run: listCitiesTool,
  },
  {
    name: 'getBusiness',
    description:
      'Get one business in full: its services with prices and durations, its professionals, and its booking policy.',
    mutates: false,
    public: true,
    schema: slugInput,
    run: getBusinessTool,
  },
  {
    name: 'getAvailability',
    description:
      'Get the real free slots for a service on one day. This is the only source of availability; never infer it.',
    mutates: false,
    public: true,
    schema: availabilityInput,
    run: getAvailabilityTool,
  },
  {
    name: 'createReservation',
    description:
      'Book one of the slots returned by getAvailability. Requires confirmed: true, which you may only set after the customer has agreed.',
    mutates: true,
    public: false,
    schema: createInput,
    run: createReservationTool,
  },
  {
    name: 'cancelReservation',
    description:
      "Cancel the customer's own appointment. Requires confirmed: true.",
    mutates: true,
    public: false,
    schema: cancelInput,
    run: cancelReservationTool,
  },
  {
    name: 'rescheduleReservation',
    description:
      "Move the customer's own appointment to a slot returned by getAvailability. Requires confirmed: true.",
    mutates: true,
    public: false,
    schema: rescheduleInput,
    run: rescheduleReservationTool,
  },
  {
    name: 'getMyReservations',
    description: "List the signed-in customer's upcoming appointments.",
    mutates: false,
    public: false,
    schema: z.object({}),
    run: myReservationsTool,
  },
];

const BY_NAME = new Map(ASSISTANT_TOOLS.map((t) => [t.name, t]));

/**
 * Call a tool by name.
 *
 * The single entry point, so authentication and the unknown-name case are
 * handled once. A name the model invented is a clean refusal — never a thrown
 * exception that takes the conversation down.
 */
export async function callAssistantTool(
  ctx: AssistantContext,
  name: string,
  input: unknown,
): Promise<ToolResult<unknown>> {
  const tool = BY_NAME.get(name);
  if (!tool) return fail('UNKNOWN_TOOL', `There is no tool called "${name}".`);

  if (!tool.public && !ctx.actor) {
    return fail('UNAUTHENTICATED', 'The customer needs to sign in for this.');
  }

  try {
    return await tool.run(ctx, input);
  } catch (error) {
    // A schema failure inside a tool lands here; the model gets told what to fix.
    if (error instanceof z.ZodError) {
      return fail('VALIDATION_FAILED', error.issues[0]?.message ?? 'Invalid arguments.');
    }
    return toResult(error);
  }
}

/** The tool list in the shape most model APIs expect. */
export function assistantToolSchemas() {
  return ASSISTANT_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: z.toJSONSchema(t.schema, { io: 'input' }),
  }));
}

export { invalid, notFound };
