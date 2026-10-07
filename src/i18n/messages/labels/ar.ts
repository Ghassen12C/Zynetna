import type { labelsFr } from './fr';

export const labelsAr: typeof labelsFr = {
  businessStatus: {
    DRAFT: 'مسودّة',
    PENDING_REVIEW: 'في انتظار المراجعة',
    ACTIVE: 'منشور',
    SUSPENDED: 'موقوف',
    REJECTED: 'مرفوض',
  },
  verification: {
    UNVERIFIED: 'غير موثّق',
    PENDING: 'التوثيق جارٍ',
    VERIFIED: 'موثّق',
    REJECTED: 'التوثيق مرفوض',
  },
  servedGender: {
    WOMEN: 'نساء',
    MEN: 'رجال',
    EVERYONE: 'الجميع',
  },
  role: {
    CUSTOMER: 'زبون',
    BUSINESS_OWNER: 'صاحب المؤسسة',
    BUSINESS_EMPLOYEE: 'موظّف',
    SUPER_ADMIN: 'مشرف',
  },
  userStatus: {
    ACTIVE: 'نشط',
    SUSPENDED: 'موقوف',
    DELETED: 'محذوف',
  },
  channel: {
    ONLINE: 'عبر الإنترنت',
    WALK_IN: 'في المحل',
    PHONE: 'بالهاتف',
  },
  exceptionKind: {
    CLOSED: 'إغلاق',
    HOLIDAY: 'عطلة رسمية',
    VACATION: 'إجازة',
    BREAK: 'استراحة',
    SPECIAL_HOURS: 'أوقات استثنائية',
  },
  reviewStatus: {
    PUBLISHED: 'منشور',
    PENDING_MODERATION: 'قيد المراجعة',
    HIDDEN: 'مخفي',
    REMOVED: 'محذوف',
  },
  reportTarget: {
    BUSINESS: 'مؤسسة',
    REVIEW: 'تقييم',
    MEDIA: 'صورة',
  },
  reportStatus: {
    OPEN: 'مفتوح',
    REVIEWING: 'قيد الدراسة',
    RESOLVED: 'تمّت المعالجة',
    DISMISSED: 'أُغلق دون إجراء',
  },
  subscriptionStatus: {
    TRIALING: 'فترة تجربة مجانية',
    ACTIVE: 'نشط',
    PAST_DUE: 'دفع متأخّر',
    GRACE: 'فترة سماح',
    EXPIRED: 'منتهي',
    CANCELLED: 'ملغى',
  },
  paymentStatus: {
    PENDING: 'في الانتظار',
    SUCCEEDED: 'ناجح',
    FAILED: 'فاشل',
    REFUNDED: 'مُسترجع',
  },
  interval: {
    MONTH: 'شهر',
    YEAR: 'سنة',
  },
  mediaRole: {
    LOGO: 'الشعار',
    COVER: 'صورة الغلاف',
    EXTERIOR: 'الواجهة',
    INTERIOR: 'من الداخل',
    PORTFOLIO: 'إنجازات',
    TEAM: 'الفريق',
    GALLERY: 'المعرض',
  },
};
