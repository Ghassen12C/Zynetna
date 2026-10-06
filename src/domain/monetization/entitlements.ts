/**
 * Plan entitlements.
 *
 * Read from SubscriptionPlan.features (JSON), so a new plan is a database row
 * rather than a deployment. Future featured/sponsored placement, promo codes
 * and multi-location are gated here without touching feature code.
 */
export type Entitlements = {
  maxStaff: number | null;
  maxServices: number | null;
  maxGalleryImages: number | null;
  featuredPlacement: boolean;
  sponsoredPlacement: boolean;
  advancedAnalytics: boolean;
  customBookingPage: boolean;
  multiLocation: boolean;
  promoCodes: boolean;
};

export const DEFAULT_ENTITLEMENTS: Entitlements = {
  maxStaff: null,
  maxServices: null,
  maxGalleryImages: 60,
  featuredPlacement: false,
  sponsoredPlacement: false,
  advancedAnalytics: false,
  customBookingPage: false,
  multiLocation: false,
  promoCodes: false,
};

export function parseEntitlements(features: unknown): Entitlements {
  if (!features || typeof features !== 'object') return DEFAULT_ENTITLEMENTS;
  const raw = features as Record<string, unknown>;
  const num = (k: keyof Entitlements) =>
    typeof raw[k] === 'number' ? (raw[k] as number) : raw[k] === null ? null : undefined;
  const bool = (k: keyof Entitlements) =>
    typeof raw[k] === 'boolean' ? (raw[k] as boolean) : undefined;

  return {
    maxStaff: num('maxStaff') ?? DEFAULT_ENTITLEMENTS.maxStaff,
    maxServices: num('maxServices') ?? DEFAULT_ENTITLEMENTS.maxServices,
    maxGalleryImages: num('maxGalleryImages') ?? DEFAULT_ENTITLEMENTS.maxGalleryImages,
    featuredPlacement: bool('featuredPlacement') ?? DEFAULT_ENTITLEMENTS.featuredPlacement,
    sponsoredPlacement: bool('sponsoredPlacement') ?? DEFAULT_ENTITLEMENTS.sponsoredPlacement,
    advancedAnalytics: bool('advancedAnalytics') ?? DEFAULT_ENTITLEMENTS.advancedAnalytics,
    customBookingPage: bool('customBookingPage') ?? DEFAULT_ENTITLEMENTS.customBookingPage,
    multiLocation: bool('multiLocation') ?? DEFAULT_ENTITLEMENTS.multiLocation,
    promoCodes: bool('promoCodes') ?? DEFAULT_ENTITLEMENTS.promoCodes,
  };
}
