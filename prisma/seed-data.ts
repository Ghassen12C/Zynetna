/**
 * Seed reference data for Tunisia.
 * Businesses and people below are fictional; no real private data is used.
 */
import type { Prisma } from '@prisma/client';

export const GOVERNORATES: {
  name: string; nameAr: string; slug: string;
  cities: { name: string; nameAr: string; slug: string; lat: number; lng: number }[];
}[] = [
  {
    name: 'Tunis', nameAr: 'تونس', slug: 'tunis',
    cities: [
      { name: 'Tunis', nameAr: 'تونس', slug: 'tunis', lat: 36.8065, lng: 10.1815 },
      { name: 'La Marsa', nameAr: 'المرسى', slug: 'la-marsa', lat: 36.8781, lng: 10.3247 },
      { name: 'Le Bardo', nameAr: 'باردو', slug: 'le-bardo', lat: 36.8092, lng: 10.1400 },
      { name: 'Carthage', nameAr: 'قرطاج', slug: 'carthage', lat: 36.8528, lng: 10.3294 },
    ],
  },
  {
    name: 'Ariana', nameAr: 'أريانة', slug: 'ariana',
    cities: [
      { name: 'Ariana', nameAr: 'أريانة', slug: 'ariana', lat: 36.8625, lng: 10.1956 },
      { name: 'Raoued', nameAr: 'رواد', slug: 'raoued', lat: 36.9167, lng: 10.1833 },
    ],
  },
  {
    name: 'Ben Arous', nameAr: 'بن عروس', slug: 'ben-arous',
    cities: [
      { name: 'Ben Arous', nameAr: 'بن عروس', slug: 'ben-arous', lat: 36.7533, lng: 10.2317 },
      { name: 'Ezzahra', nameAr: 'الزهراء', slug: 'ezzahra', lat: 36.7406, lng: 10.3092 },
    ],
  },
  {
    name: 'Sfax', nameAr: 'صفاقس', slug: 'sfax',
    cities: [{ name: 'Sfax', nameAr: 'صفاقس', slug: 'sfax', lat: 34.7406, lng: 10.7603 }],
  },
  {
    name: 'Sousse', nameAr: 'سوسة', slug: 'sousse',
    cities: [
      { name: 'Sousse', nameAr: 'سوسة', slug: 'sousse', lat: 35.8256, lng: 10.6084 },
      { name: 'Hammam Sousse', nameAr: 'حمام سوسة', slug: 'hammam-sousse', lat: 35.8611, lng: 10.5944 },
    ],
  },
  {
    name: 'Monastir', nameAr: 'المنستير', slug: 'monastir',
    cities: [{ name: 'Monastir', nameAr: 'المنستير', slug: 'monastir', lat: 35.7780, lng: 10.8262 }],
  },
  {
    name: 'Nabeul', nameAr: 'نابل', slug: 'nabeul',
    cities: [
      { name: 'Nabeul', nameAr: 'نابل', slug: 'nabeul', lat: 36.4561, lng: 10.7376 },
      { name: 'Hammamet', nameAr: 'الحمامات', slug: 'hammamet', lat: 36.4000, lng: 10.6167 },
    ],
  },
  {
    name: 'Bizerte', nameAr: 'بنزرت', slug: 'bizerte',
    cities: [{ name: 'Bizerte', nameAr: 'بنزرت', slug: 'bizerte', lat: 37.2746, lng: 9.8739 }],
  },
  {
    name: 'Médenine', nameAr: 'مدنين', slug: 'medenine',
    cities: [{ name: 'Djerba — Houmt Souk', nameAr: 'جربة — حومة السوق', slug: 'djerba', lat: 33.8756, lng: 10.8571 }],
  },
];

export const CATEGORY_TREE: {
  slug: string; name: string; nameAr: string; nameEn: string; icon: string;
  servedGender: 'WOMEN' | 'MEN' | 'EVERYONE';
  children: { slug: string; name: string; nameAr: string; nameEn: string; servedGender: 'WOMEN' | 'MEN' | 'EVERYONE' }[];
}[] = [
  {
    slug: 'coiffure-femme', name: 'Coiffure femme', nameAr: 'تصفيف الشعر للنساء',
    nameEn: 'Women’s hair', icon: '💇‍♀️', servedGender: 'WOMEN',
    children: [
      { slug: 'coupe-femme', name: 'Coupe', nameAr: 'قص الشعر', nameEn: 'Haircut', servedGender: 'WOMEN' },
      { slug: 'brushing', name: 'Brushing', nameAr: 'تصفيف', nameEn: 'Blow-dry', servedGender: 'WOMEN' },
      { slug: 'coloration', name: 'Coloration', nameAr: 'صباغة', nameEn: 'Colouring', servedGender: 'WOMEN' },
      { slug: 'soin-cheveux', name: 'Soin capillaire', nameAr: 'علاج الشعر', nameEn: 'Hair treatment', servedGender: 'WOMEN' },
    ],
  },
  {
    slug: 'barbier', name: 'Barbier', nameAr: 'حلاق', nameEn: 'Barber', icon: '💈', servedGender: 'MEN',
    children: [
      { slug: 'coupe-homme', name: 'Coupe homme', nameAr: 'قص للرجال', nameEn: 'Men’s haircut', servedGender: 'MEN' },
      { slug: 'barbe', name: 'Barbe', nameAr: 'اللحية', nameEn: 'Beard', servedGender: 'MEN' },
      { slug: 'rasage', name: 'Rasage traditionnel', nameAr: 'حلاقة تقليدية', nameEn: 'Traditional shave', servedGender: 'MEN' },
    ],
  },
  {
    slug: 'ongles', name: 'Ongles', nameAr: 'الأظافر', nameEn: 'Nails', icon: '💅', servedGender: 'WOMEN',
    children: [
      { slug: 'manucure', name: 'Manucure', nameAr: 'العناية بالأظافر', nameEn: 'Manicure', servedGender: 'WOMEN' },
      { slug: 'pedicure', name: 'Pédicure', nameAr: 'باديكير', nameEn: 'Pedicure', servedGender: 'WOMEN' },
    ],
  },
  {
    slug: 'esthetique', name: 'Esthétique', nameAr: 'التجميل', nameEn: 'Beauty', icon: '✨', servedGender: 'WOMEN',
    children: [
      { slug: 'maquillage', name: 'Maquillage', nameAr: 'مكياج', nameEn: 'Make-up', servedGender: 'WOMEN' },
      { slug: 'cils', name: 'Cils', nameAr: 'الرموش', nameEn: 'Eyelashes', servedGender: 'WOMEN' },
      { slug: 'sourcils', name: 'Sourcils', nameAr: 'الحواجب', nameEn: 'Eyebrows', servedGender: 'WOMEN' },
      { slug: 'soin-visage', name: 'Soin du visage', nameAr: 'العناية بالوجه', nameEn: 'Facial', servedGender: 'EVERYONE' },
    ],
  },
  {
    slug: 'bien-etre', name: 'Bien-être', nameAr: 'العافية', nameEn: 'Wellness', icon: '🌿', servedGender: 'EVERYONE',
    children: [
      { slug: 'massage', name: 'Massage', nameAr: 'تدليك', nameEn: 'Massage', servedGender: 'EVERYONE' },
      { slug: 'spa', name: 'Spa', nameAr: 'منتجع', nameEn: 'Spa', servedGender: 'EVERYONE' },
      { slug: 'hammam', name: 'Hammam', nameAr: 'حمام', nameEn: 'Hammam', servedGender: 'EVERYONE' },
    ],
  },
];

/** The launch offer as data: 2 months free, then 30 TND a month. */
export const PLANS: Prisma.SubscriptionPlanCreateInput[] = [
  {
    code: 'pro-monthly', name: 'Zynetna Pro',
    description: 'Vitrine digitale complète, réservation en ligne et gestion d’établissement.',
    priceAmount: 30, currency: 'TND', interval: 'MONTH',
    trialDays: 60, gracePeriodDays: 7, isDefault: true, position: 0,
    features: {
      maxStaff: null, maxServices: null, maxGalleryImages: 60,
      featuredPlacement: false, sponsoredPlacement: false,
      advancedAnalytics: false, customBookingPage: false,
      multiLocation: false, promoCodes: false,
    },
  },
  {
    code: 'pro-annual', name: 'Zynetna Pro — annuel',
    description: 'Deux mois offerts sur l’année.',
    priceAmount: 300, currency: 'TND', interval: 'YEAR',
    trialDays: 60, gracePeriodDays: 14, isActive: true, position: 1,
    features: { maxGalleryImages: 120, advancedAnalytics: true },
  },
];

export const PLATFORM_SETTINGS: Prisma.PlatformSettingCreateManyInput[] = [
  { key: 'notifications.reminderOffsetsHours', value: [24, 2], description: 'Heures avant le rendez-vous pour les rappels.' },
  { key: 'marketplace.requireApproval', value: true, description: 'Les nouveaux établissements passent par une validation.' },
  { key: 'marketplace.defaultRadiusKm', value: 25, description: 'Rayon par défaut de la recherche « près de moi ».' },
  { key: 'subscription.currency', value: 'TND', description: 'Devise de facturation.' },
  { key: 'reviews.autoPublish', value: true, description: 'Publier les avis sans modération préalable.' },
];

export const FEATURE_FLAGS: Prisma.FeatureFlagCreateManyInput[] = [
  { key: 'map.discovery', description: 'Découverte par carte', isEnabled: true },
  { key: 'reviews.photos', description: 'Photos dans les avis', isEnabled: false },
  { key: 'payments.online', description: 'Paiement en ligne', isEnabled: false },
  { key: 'notifications.whatsapp', description: 'Notifications WhatsApp', isEnabled: false },
];
