import type { labelsFr } from './fr';

export const labelsEn: typeof labelsFr = {
  businessStatus: {
    DRAFT: 'Draft',
    PENDING_REVIEW: 'Awaiting review',
    ACTIVE: 'Live',
    SUSPENDED: 'Suspended',
    REJECTED: 'Rejected',
  },
  verification: {
    UNVERIFIED: 'Unverified',
    PENDING: 'Verification pending',
    VERIFIED: 'Verified',
    REJECTED: 'Verification rejected',
  },
  servedGender: {
    WOMEN: 'Women',
    MEN: 'Men',
    EVERYONE: 'Everyone',
  },
  role: {
    CUSTOMER: 'Customer',
    BUSINESS_OWNER: 'Owner',
    BUSINESS_EMPLOYEE: 'Employee',
    SUPER_ADMIN: 'Admin',
  },
  userStatus: {
    ACTIVE: 'Active',
    SUSPENDED: 'Suspended',
    DELETED: 'Deleted',
  },
  channel: {
    ONLINE: 'Online',
    WALK_IN: 'Walk-in',
    PHONE: 'Phone',
  },
  exceptionKind: {
    CLOSED: 'Closure',
    HOLIDAY: 'Public holiday',
    VACATION: 'Time off',
    BREAK: 'Break',
    SPECIAL_HOURS: 'Special hours',
  },
  reviewStatus: {
    PUBLISHED: 'Published',
    PENDING_MODERATION: 'In moderation',
    HIDDEN: 'Hidden',
    REMOVED: 'Removed',
  },
  reportTarget: {
    BUSINESS: 'Business',
    REVIEW: 'Review',
    MEDIA: 'Photo',
  },
  reportStatus: {
    OPEN: 'Open',
    REVIEWING: 'Under review',
    RESOLVED: 'Resolved',
    DISMISSED: 'Dismissed',
  },
  subscriptionStatus: {
    TRIALING: 'Free trial',
    ACTIVE: 'Active',
    PAST_DUE: 'Payment overdue',
    GRACE: 'Grace period',
    EXPIRED: 'Expired',
    CANCELLED: 'Cancelled',
  },
  paymentStatus: {
    PENDING: 'Pending',
    SUCCEEDED: 'Succeeded',
    FAILED: 'Failed',
    REFUNDED: 'Refunded',
  },
  interval: {
    MONTH: 'month',
    YEAR: 'year',
  },
  mediaRole: {
    LOGO: 'Logo',
    COVER: 'Cover',
    EXTERIOR: 'Exterior',
    INTERIOR: 'Interior',
    PORTFOLIO: 'Portfolio',
    TEAM: 'Team',
    GALLERY: 'Gallery',
  },
};
