import { describe, expect, it } from 'vitest';
import {
  AVATAR_STATES,
  type AvatarState,
  autoSettleMs,
  canTransition,
  isBusy,
  isRecording,
  nextState,
} from '@/domain/avatar/states';

describe('avatar state machine', () => {
  it('can reach every state from somewhere', () => {
    for (const target of AVATAR_STATES) {
      const reachable = AVATAR_STATES.some(
        (from) => from !== target && canTransition(from, target),
      );
      expect(reachable, `${target} is unreachable`).toBe(true);
    }
  });

  it('always allows a way back to IDLE', () => {
    for (const from of AVATAR_STATES) {
      if (from === 'IDLE') continue;
      expect(canTransition(from, 'IDLE'), `${from} cannot settle`).toBe(true);
    }
  });

  it('refuses to claim a booking straight out of listening or thinking', () => {
    // A confirmed booking is something the backend reports after a real write.
    // The avatar must never be able to assert it on its own.
    expect(canTransition('LISTENING', 'BOOKING_CONFIRMED')).toBe(false);
    expect(canTransition('THINKING', 'BOOKING_CONFIRMED')).toBe(false);
    expect(canTransition('GREETING', 'BOOKING_CONFIRMED')).toBe(false);
    // Only after the system has said so, by way of a spoken or successful step.
    expect(canTransition('SPEAKING', 'BOOKING_CONFIRMED')).toBe(true);
    expect(canTransition('SUCCESS', 'BOOKING_CONFIRMED')).toBe(true);
  });

  it('listens again when the visitor returns to the field after a search', () => {
    // A search that does not navigate leaves him thinking; refocusing the
    // field must bring him back to listening rather than be ignored.
    expect(canTransition('THINKING', 'LISTENING')).toBe(true);
  });

  it('holds its pose on an illegal transition rather than throwing', () => {
    expect(nextState('LISTENING', 'BOOKING_CONFIRMED')).toBe('LISTENING');
    expect(nextState('IDLE', 'GREETING')).toBe('GREETING');
  });

  it('reports which states are busy and which hold the microphone', () => {
    expect(isBusy('THINKING')).toBe(true);
    expect(isBusy('SPEAKING')).toBe(true);
    expect(isBusy('IDLE')).toBe(false);
    expect(isBusy('LISTENING')).toBe(false);

    expect(isRecording('LISTENING')).toBe(true);
    for (const s of AVATAR_STATES.filter((x) => x !== 'LISTENING')) {
      expect(isRecording(s)).toBe(false);
    }
  });

  it('settles the transient states and waits in the rest', () => {
    expect(autoSettleMs('GREETING')).toBeGreaterThan(0);
    expect(autoSettleMs('BOOKING_CONFIRMED')).toBeGreaterThan(0);
    // Listening waits on the speaker; thinking waits on the backend.
    expect(autoSettleMs('LISTENING')).toBeNull();
    expect(autoSettleMs('THINKING')).toBeNull();
    expect(autoSettleMs('IDLE')).toBeNull();
  });

  it('never lists a state as its own successor', () => {
    for (const from of AVATAR_STATES) {
      expect(canTransition(from, from as AvatarState), `${from} loops`).toBe(false);
    }
  });
});
