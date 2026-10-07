/**
 * The Zynetna avatar's state system.
 *
 * The avatar is part of the brand, not a hero illustration, and it is meant to
 * grow from a welcome animation into a voice concierge. So its states are
 * modelled here — pure, no DOM, no React — rather than implied by a couple of
 * booleans inside a component. The visual layer renders a state; it does not
 * decide what the state means, and a future voice loop can drive the same
 * machine without touching the artwork.
 */
export const AVATAR_STATES = [
  /** Alive but unoccupied: breathing, a slow blink. */
  'IDLE',
  /** Looks at the visitor, smiles, offers a hand. */
  'GREETING',
  /** Attentive: the microphone is open. */
  'LISTENING',
  /** Working on the request. */
  'THINKING',
  /** Saying something. */
  'SPEAKING',
  /** Found what was asked for. */
  'SUCCESS',
  /** Something went wrong, explained kindly. */
  'ERROR',
  /** An appointment was actually created. */
  'BOOKING_CONFIRMED',
  /** Signing off. */
  'GOODBYE',
] as const;

export type AvatarState = (typeof AVATAR_STATES)[number];

/**
 * What may follow what.
 *
 * Deliberately not a free-for-all: the avatar must never jump from LISTENING
 * straight to BOOKING_CONFIRMED, because a confirmed booking is something the
 * backend reports after a real write, never something the presentation layer
 * can assert on its own.
 */
const TRANSITIONS: Record<AvatarState, readonly AvatarState[]> = {
  IDLE: ['GREETING', 'LISTENING', 'SPEAKING', 'THINKING', 'GOODBYE'],
  GREETING: ['IDLE', 'LISTENING', 'SPEAKING'],
  LISTENING: ['THINKING', 'IDLE', 'ERROR'],
  // Back to LISTENING when the visitor returns to the field after a search
  // that did not navigate.
  THINKING: ['SPEAKING', 'SUCCESS', 'ERROR', 'IDLE', 'LISTENING'],
  SPEAKING: ['IDLE', 'LISTENING', 'SUCCESS', 'ERROR', 'BOOKING_CONFIRMED', 'GOODBYE'],
  SUCCESS: ['IDLE', 'LISTENING', 'SPEAKING', 'BOOKING_CONFIRMED'],
  ERROR: ['IDLE', 'LISTENING', 'SPEAKING'],
  BOOKING_CONFIRMED: ['IDLE', 'SPEAKING', 'GOODBYE'],
  GOODBYE: ['IDLE'],
};

export function canTransition(from: AvatarState, to: AvatarState): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Apply a transition, or stay put.
 *
 * An illegal transition is a bug in the caller, not something to crash the
 * page over: the avatar is an enhancement and must never take the interface
 * down with it, so it holds its current pose instead.
 */
export function nextState(from: AvatarState, to: AvatarState): AvatarState {
  return canTransition(from, to) ? to : from;
}

/** States where the avatar is mid-task and should not be interrupted lightly. */
export function isBusy(state: AvatarState): boolean {
  return state === 'THINKING' || state === 'SPEAKING';
}

/** States that mean the microphone is live, which the UI must show plainly. */
export function isRecording(state: AvatarState): boolean {
  return state === 'LISTENING';
}

/**
 * States that resolve on their own after a beat, and how long to hold them.
 *
 * Returns null for states the avatar holds until something else happens, so a
 * caller can tell "wait for me" from "I will settle by myself".
 */
export function autoSettleMs(state: AvatarState): number | null {
  switch (state) {
    case 'GREETING':
      return 4200;
    case 'SUCCESS':
      return 1800;
    case 'BOOKING_CONFIRMED':
      return 3200;
    case 'ERROR':
      return 4000;
    case 'GOODBYE':
      return 2600;
    default:
      return null;
  }
}
