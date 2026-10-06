import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: 'Comment Zynetna collecte, utilise et protège vos données personnelles.',
  alternates: { canonical: '/legal/privacy' },
};

export default function PrivacyPage() {
  return (
    <div className="z-section">
      <article className="z-container z-legal">
        <h1>Politique de confidentialité</h1>
        <p className="z-help">Dernière mise à jour : octobre 2026</p>

        <p>
          Cette page décrit précisément quelles données Zynetna conserve, pourquoi, et qui
          peut les voir. Nous ne vendons aucune donnée personnelle, et nous n’en collectons
          pas plus que ce qu’un rendez-vous exige.
        </p>

        <h2>1. Données collectées</h2>
        <h3>Compte client</h3>
        <p>
          Prénom, nom, adresse e-mail, et — si vous le souhaitez — numéro de téléphone, utilisé
          uniquement pour les rappels de rendez-vous. Votre mot de passe n’est jamais stocké :
          seule une empreinte cryptographique (Argon2id) l’est, dont le mot de passe ne peut
          pas être déduit.
        </p>
        <h3>Réservations</h3>
        <p>
          Établissement, prestation, professionnel, date, heure, montant, et le message
          éventuel que vous adressez à l’établissement.
        </p>
        <h3>Techniques</h3>
        <p>
          Adresse IP et navigateur au moment de la connexion, conservés pour la sécurité du
          compte et la limitation des abus. Nous n’utilisons aucun traceur publicitaire.
        </p>

        <h2>2. Ce que voit un établissement</h2>
        <p>
          Un établissement voit, pour ses propres clients uniquement : prénom et nom, numéro de
          téléphone et e-mail, historique des rendez-vous pris chez lui, et le message que vous
          lui avez laissé. Il ne voit <strong>aucun</strong> rendez-vous pris ailleurs, ni les
          clients d’un autre établissement. Cette séparation est appliquée côté serveur.
        </p>

        <h2>3. Avis publics</h2>
        <p>
          Un avis publié affiche votre prénom et l’initiale de votre nom — jamais votre nom
          complet, votre e-mail ni votre téléphone.
        </p>

        <h2>4. Conservation</h2>
        <p>
          Les rendez-vous sont conservés tant que votre compte existe, car ils constituent
          votre historique et celui de l’établissement. Les sessions expirées sont purgées
          automatiquement. Les liens de réinitialisation de mot de passe expirent au bout
          d’une heure et ne servent qu’une fois.
        </p>

        <h2>5. Vos droits</h2>
        <p>
          Vous pouvez consulter et corriger vos informations depuis votre{' '}
          <Link href="/account/profile">profil</Link>. Pour demander une copie de vos données
          ou la suppression de votre compte, écrivez à{' '}
          <a href="mailto:privacy@zynetna.tn">privacy@zynetna.tn</a>. La suppression retire vos
          données personnelles ; les rendez-vous passés sont anonymisés plutôt que supprimés,
          afin de ne pas altérer la comptabilité des établissements.
        </p>

        <h2>6. Sécurité</h2>
        <p>
          Chiffrement en transit (HTTPS), mots de passe hachés avec Argon2id, sessions
          révocables côté serveur, limitation du nombre de tentatives de connexion, et
          validation systématique des fichiers téléversés. Les images envoyées sont ré-encodées
          côté serveur, ce qui supprime au passage les métadonnées EXIF — dont la position
          GPS.
        </p>

        <h2>7. Sous-traitants</h2>
        <p>
          L’hébergement et la base de données sont opérés sur Microsoft Azure. Les e-mails
          transactionnels (confirmations, rappels) transitent par notre prestataire d’envoi.
          Aucun de ces prestataires n’est autorisé à utiliser vos données à d’autres fins.
        </p>

        <h2>8. Localisation</h2>
        <p>
          La recherche « près de moi » utilise la position de votre appareil uniquement si vous
          l’autorisez. Elle n’est pas enregistrée : elle sert à classer les résultats de la
          recherche en cours. Un refus n’empêche en rien l’utilisation du service.
        </p>

        <h2>9. Contact</h2>
        <p>
          <a href="mailto:privacy@zynetna.tn">privacy@zynetna.tn</a> — voir aussi les{' '}
          <Link href="/legal/terms">conditions d’utilisation</Link>.
        </p>
      </article>
    </div>
  );
}
