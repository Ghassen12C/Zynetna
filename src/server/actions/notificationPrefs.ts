'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireActor } from '@/server/auth/guard';
import { setPreference } from '@/server/services/notificationPrefs';
import type { FormState } from '@/lib/formState';
import { parseForm, toFormState } from './formState';

const schema = z.object({
  type: z.string().min(1).max(64),
  channel: z.enum(['IN_APP', 'EMAIL']),
  enabled: z.enum(['true', 'false']).transform((v) => v === 'true'),
});

export async function setNotificationPreferenceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = await parseForm(schema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireActor();
    // The service decides what this person may change — an unknown or
    // irrelevant type is ignored rather than written.
    await setPreference({
      actor,
      type: parsed.data.type as Parameters<typeof setPreference>[0]['type'],
      channel: parsed.data.channel,
      enabled: parsed.data.enabled,
    });

    revalidatePath('/account/notifications');
    return { status: 'success' };
  } catch (error) {
    return toFormState(error, 'setNotificationPreferenceAction');
  }
}
