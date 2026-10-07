import type { AvatarState } from '@/domain/avatar/states';

/**
 * The channel between the interface and the Zynetna host.
 *
 * Today the search bar speaks on it: focusing the field makes the host
 * attentive, submitting makes it look busy, leaving makes it settle. The host
 * only reacts to things the visitor actually did — it never claims to have
 * understood anything — so this is presentation, not pretend intelligence.
 *
 * It is also the seam the voice concierge plugs into. A future loop emits
 * LISTENING while the microphone is open, THINKING while the tools run and
 * SPEAKING with the reply, on this same channel, and the artwork needs no
 * change. Plain DOM events keep the two sides decoupled: neither imports the
 * other, and either can be absent.
 */
export type HostCue = {
  state: AvatarState;
  /** Which line of the host's copy to show, if the cue implies one. */
  line?: 'greeting' | 'listening' | 'thinking';
};

const EVENT = 'zynetna:host';

export function cueHost(cue: HostCue): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<HostCue>(EVENT, { detail: cue }));
}

export function onHostCue(handler: (cue: HostCue) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<HostCue>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
