'use client';

import { createContext, type ReactNode, useContext } from 'react';
import type { Messages } from '@/i18n';
import type { Locale } from '@/i18n/config';
import { labelsFr } from '@/i18n/messages/labels/fr';

/**
 * The handful of words the UI primitives print themselves ("optional", a
 * rating's spoken label), in the page's language.
 *
 * Set once by the root layout, so every `Field` and `Rating` speaks the
 * visitor's language without each of their many call sites threading a
 * dictionary through. Outside the provider (tests, isolated renders) it falls
 * back to French, the reference locale.
 */
type UiText = { locale: Locale; ui: Messages['labels']['ui'] };

const Context = createContext<UiText>({ locale: 'fr', ui: labelsFr.ui });

export function UiTextProvider({ value, children }: { value: UiText; children: ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useUiText(): UiText {
  return useContext(Context);
}
