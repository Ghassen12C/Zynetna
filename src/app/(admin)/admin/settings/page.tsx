import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { Panel } from '@/components/ui/Primitives';
import { requireSuperAdmin } from '@/server/auth/guard';
import { SettingsEditor } from '@/components/admin/SettingsEditor';
import { FlagsEditor } from '@/components/admin/FlagsEditor';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.admin.nav.settings, robots: { index: false } };
}

/** Settings the code reads, in display order; their labels live in the dictionary. */
const KNOWN_SETTINGS = [
  'marketplace.requireApproval',
  'reviews.autoPublish',
  'notifications.reminderOffsetsHours',
  'marketplace.defaultRadiusKm',
  'subscription.currency',
] as const;

export default async function AdminSettingsPage() {
  await requireSuperAdmin();
  const { m, locale } = await translate();
  const st = m.admin.settings;
  const known: readonly string[] = KNOWN_SETTINGS;

  const [settings, flags] = await Promise.all([
    db.platformSetting.findMany({ orderBy: { key: 'asc' } }),
    db.featureFlag.findMany({ orderBy: { key: 'asc' } }),
  ]);

  const byKey = new Map(settings.map((s) => [s.key, s]));

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-6)' }}>
      <h1 className="z-search__title">{m.admin.nav.settings}</h1>

      <Panel className="z-dash__panel">
        <h2 className="z-profile__h3">{st.parameters}</h2>
        <p className="z-policy">{st.parametersLead}</p>
        <SettingsEditor
          settings={KNOWN_SETTINGS.map((key) => ({
            key,
            ...st.known[key],
            value: JSON.stringify(byKey.get(key)?.value ?? null),
            updatedAt: byKey.get(key)?.updatedAt?.toISOString() ?? null,
          }))}
          extra={settings
            .filter((s) => !known.includes(s.key))
            .map((s) => ({
              key: s.key,
              label: s.key,
              hint: s.description ?? '',
              value: JSON.stringify(s.value),
              updatedAt: s.updatedAt.toISOString(),
            }))}
          m={m.admin}
          saveLabel={m.common.save}
          locale={locale}
        />
      </Panel>

      <Panel className="z-dash__panel">
        <h2 className="z-profile__h3">{st.features}</h2>
        <p className="z-policy">{st.featuresLead}</p>
        <FlagsEditor
          m={m.admin}
          flags={flags.map((f) => ({
            key: f.key,
            // A known flag reads in the page language; others keep their stored text.
            description: st.flags[f.key] ?? f.description,
            isEnabled: f.isEnabled,
            rolloutPct: f.rolloutPct,
          }))}
        />
      </Panel>
    </div>
  );
}
