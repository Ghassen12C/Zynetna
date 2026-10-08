import type { PluralForms } from '../../config';

/**
 * feedback — French, the reference: en.ts and ar.ts mirror these keys.
 *
 * Everything a server action, a service or a validation schema can say back to
 * the visitor. `errors` are rendered from `AppError.i18n`, `validation` from the
 * `v.<key>` messages of the zod schemas (plus zod's own issue codes), `done`
 * are the success messages. `{count}` entries are plural-aware.
 */
export const feedbackFr = {
  done: {
    businessUpdated: 'Établissement mis à jour.',
    userUpdated: 'Utilisateur mis à jour.',
    reviewModerated: 'Avis modéré.',
    reportResolved: 'Signalement traité.',
    categorySaved: 'Catégorie enregistrée.',
    paymentRecorded: 'Paiement enregistré, abonnement réactivé.',
    planSaved: 'Formule enregistrée.',
    settingSaved: 'Réglage enregistré.',
    flagUpdated: 'Fonctionnalité mise à jour.',
    passwordChanged: 'Mot de passe mis à jour. Vos autres sessions ont été déconnectées.',
    profileSaved: 'Profil enregistré.',
    resetLinkSent:
      'Si un compte existe avec cette adresse, un lien de réinitialisation vient d’être envoyé.',
    passwordReset: 'Mot de passe réinitialisé. Vous pouvez vous connecter.',
    appointmentCancelled: 'Rendez-vous annulé.',
    businessSaved: 'Établissement enregistré.',
    addressSaved: 'Adresse enregistrée.',
    policySaved: 'Règles de réservation enregistrées.',
    serviceSaved: 'Prestation enregistrée.',
    serviceDeactivated:
      'Cette prestation a déjà été réservée : elle est désactivée plutôt que supprimée, pour préserver l’historique.',
    serviceDeleted: 'Prestation supprimée.',
    staffSaved: 'Membre de l’équipe enregistré.',
    staffDeactivated: 'Profil désactivé — l’historique des rendez-vous est conservé.',
    staffDeleted: 'Membre supprimé.',
    hoursSaved: 'Horaires enregistrés.',
    closureSaved: 'Fermeture enregistrée.',
    closureDeleted: 'Fermeture supprimée.',
    submittedForReview:
      'Votre établissement est envoyé pour validation. Vous serez notifié dès qu’il est en ligne.',
    published: 'Votre établissement est en ligne.',
    invitationSent: 'Invitation envoyée.',
    invitationRevoked: 'Invitation annulée.',
    imagesAdded: {
      one: '{count} image ajoutée.',
      other: '{count} images ajoutées.',
    } as PluralForms,
    imageDeleted: 'Image supprimée.',
    imageSaved: 'Image enregistrée.',
    photoSaved: 'Photo enregistrée.',
    reservationUpdated: 'Réservation mise à jour.',
    noteSaved: 'Note enregistrée.',
    reviewThanks: 'Merci pour votre avis.',
    replyPublished: 'Réponse publiée.',
    reportSent: 'Signalement envoyé. Merci.',
  },

  errors: {
    packNeedsServices: 'Un pack regroupe au moins deux prestations de votre établissement.',
    // Generic
    unauthenticated: 'Connectez-vous pour continuer.',
    signInRequired: 'Connectez-vous pour continuer.',
    forbidden: 'Vous n’avez pas accès à cette ressource.',
    notFound: 'Élément introuvable.',
    internal: 'Un problème est survenu de notre côté. Réessayez dans un instant.',
    rateLimited: 'Trop de requêtes. Patientez un instant.',
    retryInSeconds: {
      one: 'Trop de tentatives. Réessayez dans {count} seconde.',
      other: 'Trop de tentatives. Réessayez dans {count} secondes.',
    } as PluralForms,
    retryInMinutes: {
      one: 'Trop de tentatives. Réessayez dans {count} minute.',
      other: 'Trop de tentatives. Réessayez dans {count} minutes.',
    } as PluralForms,
    // Lookups
    businessNotFound: 'Établissement introuvable.',
    serviceNotFound: 'Prestation introuvable.',
    reservationNotFound: 'Rendez-vous introuvable.',
    userNotFound: 'Utilisateur introuvable.',
    reviewNotFound: 'Avis introuvable.',
    staffNotFound: 'Membre de l’équipe introuvable.',
    imageNotFound: 'Image introuvable.',
    parentCategoryNotFound: 'Catégorie parente introuvable.',
    planNotConfigured: 'Aucune formule d’abonnement n’est configurée.',
    subscriptionNotFound: 'Aucun abonnement pour cet établissement.',
    // Booking
    slotUnavailable: 'Ce créneau n’est plus disponible. Choisissez un autre horaire.',
    businessNotBookable: 'Cet établissement ne prend pas de réservations en ligne pour le moment.',
    staffDoesNotOfferService: 'Ce professionnel ne propose pas cette prestation.',
    illegalTransition: 'Ce rendez-vous ne peut plus passer à ce statut. Actualisez la page.',
    noServiceToReschedule: 'Ce rendez-vous n’a aucune prestation à déplacer.',
    availabilityFailed: 'Impossible de charger les disponibilités.',
    customerUnknown: 'Ce client n’a pas encore de rendez-vous chez vous.',
    // Team invitations
    roleNotInvitable: 'Ce rôle ne peut pas être attribué ici.',
    staffAlreadyLinked: 'Ce membre de l’équipe a déjà un compte associé.',
    alreadyOnTeam: 'Cette personne fait déjà partie de votre équipe.',
    invitationPending: 'Une invitation est déjà en attente pour cette adresse.',
    invitationAlreadyAccepted: 'Cette invitation a déjà été acceptée.',
    invitationInvalid: 'Ce lien d’invitation n’est pas valide.',
    invitationUsed: 'Cette invitation a déjà été utilisée.',
    invitationRevoked: 'Cette invitation a été retirée.',
    invitationExpired: 'Cette invitation a expiré. Demandez-en une nouvelle.',
    invitationWrongAccount:
      'Cette invitation a été envoyée à {email}. Connectez-vous avec cette adresse pour l’accepter.',
    // Media
    fileEmpty: 'Le fichier envoyé est vide.',
    fileTooLarge: 'Les images doivent faire moins de {size} Mo.',
    namedFileTooLarge: '« {name} » dépasse {size} Mo.',
    unsupportedImage: 'Envoyez une image JPEG, PNG, WebP ou AVIF.',
    unreadableImage: 'Ce fichier n’est pas une image lisible.',
    imageTooSmall: 'Les images doivent mesurer au moins {size}×{size} pixels.',
    imageTooLargeToProcess: 'Cette image est trop grande pour être traitée.',
    unknownImageType: 'Type d’image inconnu.',
    chooseImages: 'Choisissez au moins une image.',
    chooseImage: 'Choisissez une image.',
    tooManyImages: {
      one: '{count} image maximum à la fois.',
      other: '{count} images maximum à la fois.',
    } as PluralForms,
    // Plan limits
    galleryLimit:
      'Cet envoi dépasse la limite de photos de votre formule ({used} / {limit} utilisées).',
    serviceLimit: {
      one: 'Votre formule est limitée à {count} prestation.',
      other: 'Votre formule est limitée à {count} prestations.',
    } as PluralForms,
    staffLimit: {
      one: 'Votre formule est limitée à {count} membre d’équipe.',
      other: 'Votre formule est limitée à {count} membres d’équipe.',
    } as PluralForms,
    // Business management
    staffHasUpcoming: {
      one: '{name} a encore {count} rendez-vous à venir. Réaffectez-le ou désactivez le profil.',
      other:
        '{name} a encore {count} rendez-vous à venir. Réaffectez-les ou désactivez le profil.',
    } as PluralForms,
    hoursEndBeforeStart: 'La fin ({end}) doit être après le début ({start}).',
    hoursOverlap: 'Deux créneaux se chevauchent sur cette journée.',
    endDateBeforeStart: 'La date de fin doit être après la date de début.',
    publishMissing: 'Il manque encore {items}.',
    alreadyOwner: 'Vous gérez déjà un établissement.',
    chooseCategory: 'Choisissez une catégorie.',
    // Administration
    rejectReasonRequired: 'Indiquez le motif du refus.',
    suspendReasonRequired: 'Indiquez le motif de la suspension.',
    cannotEditSelf: 'Vous ne pouvez pas modifier votre propre compte ici.',
    lastAdmin: 'Il doit rester au moins un administrateur.',
    categoryOwnParent: 'Une catégorie ne peut pas être sa propre parente.',
    categoryDepth: 'Deux niveaux de catégories au maximum.',
    // Account
    badCredentials: 'E-mail ou mot de passe incorrect.',
    accountSuspended: 'Ce compte est suspendu. Contactez le support Zynetna.',
    emailTaken: 'Un compte existe déjà avec cet e-mail.',
    phoneTaken: 'Ce numéro est déjà associé à un autre compte.',
    currentPasswordWrong: 'Mot de passe actuel incorrect.',
    resetLinkInvalid: 'Ce lien est invalide ou a expiré. Demandez-en un nouveau.',
  },

  /** Fragments joined into `errors.publishMissing`'s `{items}`. */
  parts: {
    missingAddress: 'une adresse',
    missingService: 'au moins une prestation',
    missingStaff: 'au moins un membre d’équipe',
    missingHours: 'vos horaires d’ouverture',
  },

  validation: {
    // Generic, for zod's own issue codes
    required: 'Champ requis.',
    invalid: 'Valeur invalide.',
    invalidFormat: 'Format invalide.',
    invalidChoice: 'Choix invalide.',
    notANumber: 'Saisissez un nombre.',
    notInteger: 'Saisissez un nombre entier.',
    minChars: {
      one: 'Au moins {count} caractère.',
      other: 'Au moins {count} caractères.',
    } as PluralForms,
    maxChars: {
      one: '{count} caractère maximum.',
      other: '{count} caractères maximum.',
    } as PluralForms,
    minNumber: 'La valeur minimale est {min}.',
    maxNumber: 'La valeur maximale est {max}.',
    // Field rules
    emailRequired: 'E-mail requis.',
    emailInvalid: 'Adresse e-mail invalide.',
    passwordRequired: 'Mot de passe requis.',
    currentPasswordRequired: 'Mot de passe actuel requis.',
    passwordMismatch: 'Les mots de passe ne correspondent pas.',
    passwordTooLong: 'Ce mot de passe est trop long.',
    passwordCommon: 'Ce mot de passe est trop courant.',
    passwordMix: 'Mélangez des lettres avec au moins un chiffre ou un symbole.',
    acceptTerms: 'Vous devez accepter les conditions.',
    tooLong: 'Trop long.',
    nameTooShort: 'Nom trop court.',
    nameChars: 'Caractères non autorisés.',
    phoneInvalid: 'Numéro tunisien invalide (8 chiffres, ex. 20 123 456).',
    slugFormat: 'Lettres minuscules, chiffres et tirets.',
    addressRequired: 'Adresse requise.',
    priceNegative: 'Le prix ne peut pas être négatif.',
    priceTooHigh: 'Prix trop élevé.',
    priceDecimals: 'Deux décimales maximum.',
    durationWhole: 'Durée en minutes entières.',
    durationMin: {
      one: 'Au moins {count} minute.',
      other: 'Au moins {count} minutes.',
    } as PluralForms,
    durationMax: '10 heures maximum.',
    dateInvalid: 'Date invalide.',
    dateFormat: 'Date invalide (AAAA-MM-JJ).',
    ratingRequired: 'Note requise.',
    urlInvalid: 'Adresse web invalide (commence par https://).',
    handleInvalid: 'Identifiant invalide.',
    replyTooShort: 'Réponse trop courte.',
    walkInCustomer: 'Indiquez un client existant ou le nom de la personne.',
    alreadyUsed: 'Déjà utilisé.',
    incorrect: 'Incorrect.',
  },

  /** Transactional emails sent in the recipient's language. */
  email: {
    signature: 'Zynetna — Réserve ta chaise. Réserve ton éclat.',
    passwordReset: {
      subject: 'Réinitialiser votre mot de passe Zynetna',
      greeting: 'Bonjour {name},',
      intro: 'Vous avez demandé à réinitialiser votre mot de passe Zynetna.',
      validity: 'Ce lien est valable une heure et ne peut servir qu’une seule fois :',
      ignore:
        'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message — votre mot de passe actuel reste valable.',
    },
    invitation: {
      subject: '{inviter} vous invite à rejoindre {business} sur Zynetna',
      greeting: 'Bonjour,',
      intro: '{inviter} vous invite à rejoindre l’équipe de {business} sur Zynetna.',
      access: 'Vous pourrez consulter l’agenda et gérer les rendez-vous de l’établissement.',
      cta: 'Acceptez l’invitation ici :',
      validity: 'Ce lien est valable jusqu’au {date} et ne peut servir qu’une fois.',
      ignore: 'Si vous ne connaissez pas cet établissement, ignorez simplement ce message.',
    },
  },
};
