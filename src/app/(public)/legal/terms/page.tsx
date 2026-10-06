import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Conditions d’utilisation',
  description: 'Les conditions d’utilisation de la plateforme Zynetna.',
  alternates: { canonical: '/legal/terms' },
};

export default function TermsPage() {
  return (
    <div className="z-section">
      <article className="z-container z-legal">
        <h1>Conditions d’utilisation</h1>
        <p className="z-help">Dernière mise à jour : octobre 2026</p>

        <h2>1. Objet</h2>
        <p>
          Zynetna est une plateforme de mise en relation entre des clients et des
          établissements de beauté, de coiffure, de barbier et de bien-être en Tunisie.
          Zynetna fournit l’outil de réservation ; la prestation elle-même est fournie par
          l’établissement, sous sa seule responsabilité.
        </p>

        <h2>2. Compte</h2>
        <p>
          La création d’un compte requiert une adresse e-mail valide et un mot de passe. Vous
          êtes responsable de la confidentialité de vos identifiants et des actions effectuées
          depuis votre compte. Prévenez-nous si vous pensez qu’il a été compromis : changer
          votre mot de passe déconnecte immédiatement tous les autres appareils.
        </p>

        <h2>3. Réservations</h2>
        <p>
          Une réservation confirmée constitue un engagement envers l’établissement. Les
          conditions d’annulation, de report et d’absence sont définies par chaque
          établissement et affichées avant la confirmation.
        </p>
        <p>
          Zynetna ne perçoit aucune commission sur les prestations. Le paiement de la
          prestation s’effectue directement auprès de l’établissement.
        </p>

        <h2>4. Avis</h2>
        <p>
          Seul un client ayant effectivement honoré un rendez-vous peut publier un avis, et un
          seul avis par rendez-vous. Les avis diffamatoires, hors sujet, ou contenant des
          données personnelles de tiers sont retirés.
        </p>

        <h2>5. Obligations des établissements</h2>
        <p>
          L’établissement s’engage à publier des informations exactes (prestations, prix,
          durées, horaires), à honorer les rendez-vous confirmés, à n’utiliser les coordonnées
          de ses clients que dans le cadre de la relation de rendez-vous, et à disposer des
          autorisations requises pour son activité.
        </p>

        <h2>6. Abonnement</h2>
        <p>
          L’inscription d’un établissement ouvre une période d’essai gratuite de deux mois.
          À son terme, l’abonnement est de 30 TND par mois, sans engagement de durée. En
          l’absence de règlement au terme de la période de grâce, l’établissement cesse
          d’apparaître dans les recherches et n’accepte plus de nouvelles réservations ; les
          rendez-vous déjà pris sont maintenus.
        </p>

        <h2>7. Suspension</h2>
        <p>
          Zynetna peut suspendre un compte ou un établissement en cas de manquement à ces
          conditions, notamment pour informations trompeuses, rendez-vous non honorés de
          façon répétée, ou comportement portant atteinte aux autres utilisateurs. Le motif
          est communiqué.
        </p>

        <h2>8. Responsabilité</h2>
        <p>
          Zynetna met en œuvre les moyens raisonnables pour assurer la disponibilité du
          service, sans garantie d’absence d’interruption. Zynetna n’est pas responsable de la
          qualité des prestations fournies par les établissements.
        </p>

        <h2>9. Droit applicable</h2>
        <p>
          Les présentes conditions sont régies par le droit tunisien. Tout litige relève des
          juridictions compétentes de Tunis.
        </p>

        <h2>10. Contact</h2>
        <p>
          Pour toute question : <a href="mailto:contact@zynetna.tn">contact@zynetna.tn</a>.
          Voir aussi notre <Link href="/legal/privacy">politique de confidentialité</Link>.
        </p>
      </article>
    </div>
  );
}
