import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { Panel } from '@/components/ui/Primitives';
import { requireSuperAdmin } from '@/server/auth/guard';
import { SettingsEditor } from '@/components/admin/SettingsEditor';
import { FlagsEditor } from '@/components/admin/FlagsEditor';

export const metadata: Metadata = { title: 'Réglages', robots: { index: false } };

const KNOWN_SETTINGS: { key: string; label: string; hint: string }[] = [
  {
    key: 'marketplace.requireApproval',
    label: 'Validation des nouveaux établissements',
    hint: 'true : un établissement publié passe en attente de validation. false : il est en ligne immédiatement.',
  },
  {
    key: 'reviews.autoPublish',
    label: 'Publication automatique des avis',
    hint: 'true : les avis sont visibles dès leur envoi. false : ils attendent la modération.',
  },
  {
    key: 'notifications.reminderOffsetsHours',
    label: 'Rappels avant rendez-vous',
    hint: 'Heures avant le rendez-vous, en JSON. Exemple : [24, 2]',
  },
  {
    key: 'marketplace.defaultRadiusKm',
    label: 'Rayon « près de moi » (km)',
    hint: 'Nombre. Exemple : 25',
  },
  {
    key: 'subscription.currency',
    label: 'Devise de facturation',
    hint: 'Code ISO entre guillemets. Exemple : "TND"',
  },
];

export default async function AdminSettingsPage() {
  await requireSuperAdmin();

  const [settings, flags] = await Promise.all([
    db.platformSetting.findMany({ orderBy: { key: 'asc' } }),
    db.featureFlag.findMany({ orderBy: { key: 'asc' } }),
  ]);

  const byKey = new Map(settings.map((s) => [s.key, s]));

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-6)' }}>
      <h1 className="z-search__title">Réglages de la plateforme</h1>

      <Panel className="z-dash__panel">
        <h2 className="z-profile__h3">Paramètres</h2>
        <p className="z-policy">
          Les valeurs sont au format JSON. Elles prennent effet immédiatement, sans
          redéploiement.
        </p>
        <SettingsEditor
          settings={KNOWN_SETTINGS.map((known) => ({
            ...known,
            value: JSON.stringify(byKey.get(known.key)?.value ?? null),
            updatedAt: byKey.get(known.key)?.updatedAt?.toISOString() ?? null,
          }))}
          extra={settings
            .filter((s) => !KNOWN_SETTINGS.some((k) => k.key === s.key))
            .map((s) => ({
              key: s.key,
              label: s.key,
              hint: s.description ?? '',
              value: JSON.stringify(s.value),
              updatedAt: s.updatedAt.toISOString(),
            }))}
        />
      </Panel>

      <Panel className="z-dash__panel">
        <h2 className="z-profile__h3">Fonctionnalités</h2>
        <p className="z-policy">
          Activez ou désactivez une fonctionnalité pour toute la plateforme, sans toucher au
          code.
        </p>
        <FlagsEditor
          flags={flags.map((f) => ({
            key: f.key,
            description: f.description,
            isEnabled: f.isEnabled,
            rolloutPct: f.rolloutPct,
          }))}
        />
      </Panel>
    </div>
  );
}
