import type { PluralForms } from '@/i18n/config';

/**
 * Labels for the values the database stores as codes: statuses, roles,
 * channels. Shared by the professional dashboard and the admin, so a status
 * reads the same wherever it appears.
 */
export const labelsFr = {
  businessStatus: {
    DRAFT: 'Brouillon',
    PENDING_REVIEW: 'En attente de validation',
    ACTIVE: 'En ligne',
    SUSPENDED: 'Suspendu',
    REJECTED: 'Refusé',
  },
  verification: {
    UNVERIFIED: 'Non vérifié',
    PENDING: 'Vérification en cours',
    VERIFIED: 'Vérifié',
    REJECTED: 'Vérification refusée',
  },
  servedGender: {
    WOMEN: 'Femmes',
    MEN: 'Hommes',
    EVERYONE: 'Tout le monde',
  },
  role: {
    CUSTOMER: 'Client',
    BUSINESS_OWNER: 'Propriétaire',
    BUSINESS_EMPLOYEE: 'Employé',
    SUPER_ADMIN: 'Admin',
  },
  userStatus: {
    ACTIVE: 'Actif',
    SUSPENDED: 'Suspendu',
    DELETED: 'Supprimé',
  },
  channel: {
    ONLINE: 'En ligne',
    WALK_IN: 'Sur place',
    PHONE: 'Téléphone',
  },
  exceptionKind: {
    CLOSED: 'Fermeture',
    HOLIDAY: 'Jour férié',
    VACATION: 'Congés',
    BREAK: 'Pause',
    SPECIAL_HOURS: 'Horaires exceptionnels',
  },
  reviewStatus: {
    PUBLISHED: 'Publié',
    PENDING_MODERATION: 'En modération',
    HIDDEN: 'Masqué',
    REMOVED: 'Supprimé',
  },
  reportTarget: {
    BUSINESS: 'Établissement',
    REVIEW: 'Avis',
    MEDIA: 'Photo',
  },
  reportStatus: {
    OPEN: 'Ouvert',
    REVIEWING: 'En cours d’examen',
    RESOLVED: 'Résolu',
    DISMISSED: 'Classé sans suite',
  },
  subscriptionStatus: {
    TRIALING: 'Essai gratuit',
    ACTIVE: 'Actif',
    PAST_DUE: 'Paiement en retard',
    GRACE: 'Période de grâce',
    EXPIRED: 'Expiré',
    CANCELLED: 'Résilié',
  },
  paymentStatus: {
    PENDING: 'En attente',
    SUCCEEDED: 'Réussi',
    FAILED: 'Échoué',
    REFUNDED: 'Remboursé',
  },
  interval: {
    MONTH: 'mois',
    YEAR: 'an',
  },
  mediaRole: {
    LOGO: 'Logo',
    COVER: 'Couverture',
    EXTERIOR: 'Façade',
    INTERIOR: 'Intérieur',
    PORTFOLIO: 'Réalisations',
    TEAM: 'Équipe',
    GALLERY: 'Galerie',
  },
  ui: {
    optional: 'optionnel',
    ratingOutOf: '{value} sur 5',
    ratingWithReviews: '{value} sur 5, {reviews}',
    reviews: { one: '{count} avis', other: '{count} avis' } as PluralForms,
    chartEmpty: 'Pas encore de données.',
  },
};
