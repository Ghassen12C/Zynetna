'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getActor } from '@/server/auth/session';
import type { FormState } from '@/lib/formState';
import { toFormState } from './formState';

/** Toggle a favourite. Returns an error state (not a redirect) so the client
 *  can send an anonymous visitor to sign in without losing their place. */
export async function toggleFavoriteAction(businessId: string): Promise<FormState> {
  try {
    const actor = await getActor();
    if (!actor) return { status: 'error', message: 'UNAUTHENTICATED' };

    const existing = await db.favorite.findUnique({
      where: { userId_businessId: { userId: actor.userId, businessId } },
    });

    if (existing) {
      await db.favorite.delete({
        where: { userId_businessId: { userId: actor.userId, businessId } },
      });
    } else {
      // Confirm the business exists before creating, so a bad id cannot
      // seed junk rows.
      const business = await db.business.findUnique({
        where: { id: businessId },
        select: { id: true },
      });
      if (!business) return { status: 'error', message: 'Établissement introuvable.' };
      await db.favorite.create({ data: { userId: actor.userId, businessId } });
    }

    revalidatePath('/account/favorites');
    return { status: 'success' };
  } catch (error) {
    return toFormState(error, 'toggleFavoriteAction');
  }
}
