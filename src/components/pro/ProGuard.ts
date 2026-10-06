import { redirect } from 'next/navigation';
import type { Permission } from '@/domain/identity/permissions';
import { getActor } from '@/server/auth/session';
import { primaryBusinessId, requireBusinessAccess } from '@/server/auth/guard';

/**
 * Entry guard shared by every /pro page: resolve the actor, resolve their
 * business, and check the permission — in that order, before any data read.
 */
export async function proContext(permission: Permission, path: string) {
  const actor = await getActor();
  if (!actor) redirect(`/login?redirectTo=${encodeURIComponent(path)}`);

  const id = await primaryBusinessId(actor);
  if (!id) redirect('/pro/onboarding');

  return requireBusinessAccess(id, permission);
}
