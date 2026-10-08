/**
 * Seed reference data for Tunisia.
 * Businesses and people below are fictional; no real private data is used.
 */
import type { Prisma } from '@prisma/client';

export const GOVERNORATES: {
  name: string; nameAr: string; slug: string;
  cities: { name: string; nameAr: string; slug: string; lat: number; lng: number }[];
}[] = [
  // All 24 governorates; city coordinates are approximate town centres,
  // used for map pins and distance sorting only.
  {
    name: 'Tunis', nameAr: 'تونس', slug: 'tunis',
    cities: [
      { name: 'Tunis', nameAr: 'تونس', slug: 'tunis', lat: 36.8065, lng: 10.1815 },
      { name: 'La Marsa', nameAr: 'المرسى', slug: 'la-marsa', lat: 36.8781, lng: 10.3247 },
      { name: 'Le Bardo', nameAr: 'باردو', slug: 'le-bardo', lat: 36.8092, lng: 10.1400 },
      { name: 'Carthage', nameAr: 'قرطاج', slug: 'carthage', lat: 36.8528, lng: 10.3294 },
      { name: 'Les Berges du Lac', nameAr: 'ضفاف البحيرة', slug: 'berges-du-lac', lat: 36.8380, lng: 10.2400 },
      { name: 'La Goulette', nameAr: 'حلق الوادي', slug: 'la-goulette', lat: 36.8181, lng: 10.3050 },
    ],
  },
  {
    name: 'Ariana', nameAr: 'أريانة', slug: 'ariana',
    cities: [
      { name: 'Ariana', nameAr: 'أريانة', slug: 'ariana', lat: 36.8625, lng: 10.1956 },
      { name: 'Raoued', nameAr: 'رواد', slug: 'raoued', lat: 36.9167, lng: 10.1833 },
      { name: 'La Soukra', nameAr: 'سكرة', slug: 'la-soukra', lat: 36.8722, lng: 10.2361 },
    ],
  },
  {
    name: 'Ben Arous', nameAr: 'بن عروس', slug: 'ben-arous',
    cities: [
      { name: 'Ben Arous', nameAr: 'بن عروس', slug: 'ben-arous', lat: 36.7533, lng: 10.2317 },
      { name: 'Ezzahra', nameAr: 'الزهراء', slug: 'ezzahra', lat: 36.7406, lng: 10.3092 },
      { name: 'Radès', nameAr: 'رادس', slug: 'rades', lat: 36.7686, lng: 10.2753 },
      { name: 'Hammam Lif', nameAr: 'حمام الأنف', slug: 'hammam-lif', lat: 36.7272, lng: 10.3417 },
      { name: 'El Mourouj', nameAr: 'المروج', slug: 'el-mourouj', lat: 36.7303, lng: 10.2072 },
      { name: 'Mégrine', nameAr: 'مقرين', slug: 'megrine', lat: 36.7703, lng: 10.2336 },
    ],
  },
  {
    name: 'Manouba', nameAr: 'منوبة', slug: 'manouba',
    cities: [
      { name: 'Manouba', nameAr: 'منوبة', slug: 'manouba', lat: 36.8081, lng: 10.0972 },
      { name: 'Oued Ellil', nameAr: 'وادي الليل', slug: 'oued-ellil', lat: 36.8333, lng: 10.0333 },
    ],
  },
  {
    name: 'Nabeul', nameAr: 'نابل', slug: 'nabeul',
    cities: [
      { name: 'Nabeul', nameAr: 'نابل', slug: 'nabeul', lat: 36.4561, lng: 10.7376 },
      { name: 'Hammamet', nameAr: 'الحمامات', slug: 'hammamet', lat: 36.4000, lng: 10.6167 },
      { name: 'Kélibia', nameAr: 'قليبية', slug: 'kelibia', lat: 36.8478, lng: 11.0939 },
      { name: 'Korba', nameAr: 'قربة', slug: 'korba', lat: 36.5786, lng: 10.8586 },
      { name: 'Menzel Temime', nameAr: 'منزل تميم', slug: 'menzel-temime', lat: 36.7814, lng: 10.9875 },
    ],
  },
  {
    name: 'Zaghouan', nameAr: 'زغوان', slug: 'zaghouan',
    cities: [
      { name: 'Zaghouan', nameAr: 'زغوان', slug: 'zaghouan', lat: 36.4029, lng: 10.1429 },
      { name: 'El Fahs', nameAr: 'الفحص', slug: 'el-fahs', lat: 36.3747, lng: 9.9067 },
    ],
  },
  {
    name: 'Bizerte', nameAr: 'بنزرت', slug: 'bizerte',
    cities: [
      { name: 'Bizerte', nameAr: 'بنزرت', slug: 'bizerte', lat: 37.2746, lng: 9.8739 },
      { name: 'Menzel Bourguiba', nameAr: 'منزل بورقيبة', slug: 'menzel-bourguiba', lat: 37.1531, lng: 9.7861 },
      { name: 'Mateur', nameAr: 'ماطر', slug: 'mateur', lat: 37.0400, lng: 9.6650 },
    ],
  },
  {
    name: 'Béja', nameAr: 'باجة', slug: 'beja',
    cities: [
      { name: 'Béja', nameAr: 'باجة', slug: 'beja', lat: 36.7256, lng: 9.1817 },
      { name: 'Medjez el-Bab', nameAr: 'مجاز الباب', slug: 'medjez-el-bab', lat: 36.6500, lng: 9.6100 },
    ],
  },
  {
    name: 'Jendouba', nameAr: 'جندوبة', slug: 'jendouba',
    cities: [
      { name: 'Jendouba', nameAr: 'جندوبة', slug: 'jendouba', lat: 36.5011, lng: 8.7802 },
      { name: 'Tabarka', nameAr: 'طبرقة', slug: 'tabarka', lat: 36.9544, lng: 8.7581 },
      { name: 'Aïn Draham', nameAr: 'عين دراهم', slug: 'ain-draham', lat: 36.7790, lng: 8.6870 },
    ],
  },
  {
    name: 'Le Kef', nameAr: 'الكاف', slug: 'le-kef',
    cities: [
      { name: 'Le Kef', nameAr: 'الكاف', slug: 'le-kef', lat: 36.1822, lng: 8.7147 },
    ],
  },
  {
    name: 'Siliana', nameAr: 'سليانة', slug: 'siliana',
    cities: [
      { name: 'Siliana', nameAr: 'سليانة', slug: 'siliana', lat: 36.0849, lng: 9.3708 },
      { name: 'Makthar', nameAr: 'مكثر', slug: 'makthar', lat: 35.8580, lng: 9.2050 },
    ],
  },
  {
    name: 'Sousse', nameAr: 'سوسة', slug: 'sousse',
    cities: [
      { name: 'Sousse', nameAr: 'سوسة', slug: 'sousse', lat: 35.8256, lng: 10.6084 },
      { name: 'Hammam Sousse', nameAr: 'حمام سوسة', slug: 'hammam-sousse', lat: 35.8611, lng: 10.5944 },
      { name: 'Msaken', nameAr: 'مساكن', slug: 'msaken', lat: 35.7333, lng: 10.5833 },
      { name: 'Akouda', nameAr: 'أكودة', slug: 'akouda', lat: 35.8711, lng: 10.5703 },
      { name: 'Kalâa Kebira', nameAr: 'القلعة الكبرى', slug: 'kalaa-kebira', lat: 35.8667, lng: 10.5333 },
    ],
  },
  {
    name: 'Monastir', nameAr: 'المنستير', slug: 'monastir',
    cities: [
      { name: 'Monastir', nameAr: 'المنستير', slug: 'monastir', lat: 35.7780, lng: 10.8262 },
      { name: 'Ksar Hellal', nameAr: 'قصر هلال', slug: 'ksar-hellal', lat: 35.6436, lng: 10.8906 },
      { name: 'Moknine', nameAr: 'المكنين', slug: 'moknine', lat: 35.6253, lng: 10.9031 },
      { name: 'Jemmal', nameAr: 'جمال', slug: 'jemmal', lat: 35.6236, lng: 10.7594 },
    ],
  },
  {
    name: 'Mahdia', nameAr: 'المهدية', slug: 'mahdia',
    cities: [
      { name: 'Mahdia', nameAr: 'المهدية', slug: 'mahdia', lat: 35.5047, lng: 11.0622 },
      { name: 'Ksour Essef', nameAr: 'قصور الساف', slug: 'ksour-essef', lat: 35.4180, lng: 10.9940 },
      { name: 'El Jem', nameAr: 'الجم', slug: 'el-jem', lat: 35.2964, lng: 10.7128 },
    ],
  },
  {
    name: 'Kairouan', nameAr: 'القيروان', slug: 'kairouan',
    cities: [
      { name: 'Kairouan', nameAr: 'القيروان', slug: 'kairouan', lat: 35.6781, lng: 10.0963 },
    ],
  },
  {
    name: 'Kasserine', nameAr: 'القصرين', slug: 'kasserine',
    cities: [
      { name: 'Kasserine', nameAr: 'القصرين', slug: 'kasserine', lat: 35.1676, lng: 8.8365 },
      { name: 'Sbeitla', nameAr: 'سبيطلة', slug: 'sbeitla', lat: 35.2364, lng: 9.1214 },
    ],
  },
  {
    name: 'Sidi Bouzid', nameAr: 'سيدي بوزيد', slug: 'sidi-bouzid',
    cities: [
      { name: 'Sidi Bouzid', nameAr: 'سيدي بوزيد', slug: 'sidi-bouzid', lat: 35.0382, lng: 9.4849 },
    ],
  },
  {
    name: 'Sfax', nameAr: 'صفاقس', slug: 'sfax',
    cities: [
      { name: 'Sfax', nameAr: 'صفاقس', slug: 'sfax', lat: 34.7406, lng: 10.7603 },
      { name: 'Sakiet Ezzit', nameAr: 'ساقية الزيت', slug: 'sakiet-ezzit', lat: 34.8060, lng: 10.7620 },
      { name: 'Sakiet Eddaier', nameAr: 'ساقية الدائر', slug: 'sakiet-eddaier', lat: 34.7997, lng: 10.7742 },
      { name: 'Thyna', nameAr: 'طينة', slug: 'thyna', lat: 34.6897, lng: 10.7064 },
      { name: 'Kerkennah', nameAr: 'قرقنة', slug: 'kerkennah', lat: 34.7128, lng: 11.1950 },
    ],
  },
  {
    name: 'Gafsa', nameAr: 'قفصة', slug: 'gafsa',
    cities: [
      { name: 'Gafsa', nameAr: 'قفصة', slug: 'gafsa', lat: 34.4250, lng: 8.7842 },
      { name: 'Métlaoui', nameAr: 'المتلوي', slug: 'metlaoui', lat: 34.3214, lng: 8.4014 },
    ],
  },
  {
    name: 'Tozeur', nameAr: 'توزر', slug: 'tozeur',
    cities: [
      { name: 'Tozeur', nameAr: 'توزر', slug: 'tozeur', lat: 33.9197, lng: 8.1335 },
      { name: 'Nefta', nameAr: 'نفطة', slug: 'nefta', lat: 33.8733, lng: 7.8775 },
    ],
  },
  {
    name: 'Kebili', nameAr: 'قبلي', slug: 'kebili',
    cities: [
      { name: 'Kebili', nameAr: 'قبلي', slug: 'kebili', lat: 33.7044, lng: 8.9690 },
      { name: 'Douz', nameAr: 'دوز', slug: 'douz', lat: 33.4572, lng: 9.0203 },
    ],
  },
  {
    name: 'Gabès', nameAr: 'قابس', slug: 'gabes',
    cities: [
      { name: 'Gabès', nameAr: 'قابس', slug: 'gabes', lat: 33.8815, lng: 10.0982 },
      { name: 'Mareth', nameAr: 'مارث', slug: 'mareth', lat: 33.6333, lng: 10.2833 },
    ],
  },
  {
    name: 'Médenine', nameAr: 'مدنين', slug: 'medenine',
    cities: [
      { name: 'Djerba — Houmt Souk', nameAr: 'جربة — حومة السوق', slug: 'djerba', lat: 33.8756, lng: 10.8571 },
      { name: 'Djerba — Midoun', nameAr: 'جربة — ميدون', slug: 'djerba-midoun', lat: 33.8081, lng: 10.9922 },
      { name: 'Médenine', nameAr: 'مدنين', slug: 'medenine-ville', lat: 33.3547, lng: 10.5053 },
      { name: 'Zarzis', nameAr: 'جرجيس', slug: 'zarzis', lat: 33.5039, lng: 11.1122 },
    ],
  },
  {
    name: 'Tataouine', nameAr: 'تطاوين', slug: 'tataouine',
    cities: [
      { name: 'Tataouine', nameAr: 'تطاوين', slug: 'tataouine', lat: 32.9297, lng: 10.4518 },
    ],
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
