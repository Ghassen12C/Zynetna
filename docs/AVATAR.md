# The Zynetna host

Zynetna's avatar is a Tunisian in a chechia who welcomes the visitor. It is
part of the brand, not a hero illustration, and the long-term intent is that it
becomes a voice concierge: the customer says what they want, the avatar
understands, searches the marketplace, checks real availability and books.

This document records how that is staged, and — more importantly — the
boundaries that make the later stages safe to build.

## Where it stands

**Shipped.** The host greets the visitor on the home page: it rises into place,
waves, offers a hand and speaks a Tunisian greeting ("Aaslema! Marhbé bik fi
Zynetna"), then settles into a slow breathing idle. It is roughly 4 KB of
inline SVG driven by CSS keyframes — no WebGL context, no Lottie payload, no
animation loop on the main thread — so it costs a mid-range Android phone on
Tunisian 4G almost nothing.

**Not shipped, and not pretended.** There is no microphone, no speech, no AI.
A button that opened a microphone and did nothing would be exactly the fake
functionality this product forbids. What exists instead is the architecture
that makes voice an addition rather than a rewrite.

## The state system

`src/domain/avatar/states.ts` — pure, no DOM, no React.

```
IDLE · GREETING · LISTENING · THINKING · SPEAKING
SUCCESS · ERROR · BOOKING_CONFIRMED · GOODBYE
```

The component renders a state; it does not decide what a state means. Today the
home page drives `IDLE → GREETING → IDLE`. A future voice loop drives the same
machine through `LISTENING` and `THINKING` without touching the artwork, because
every pose lives in CSS keyed on `data-state`.

Transitions are constrained rather than free. `LISTENING → BOOKING_CONFIRMED`
is illegal and tested: a confirmed booking is something the backend reports
after a real write, never something the presentation layer can assert. An
illegal transition holds the current pose instead of throwing — the avatar is
an enhancement and must never take the interface down with it.

## The tool boundary

`src/server/assistant/tools.ts` is the only surface a future AI gets.

```
model → callAssistantTool() → application service → database
```

Nine capabilities: `searchBusinesses`, `listCategories`, `listCities`,
`getBusiness`, `getAvailability`, `createReservation`, `cancelReservation`,
`rescheduleReservation`, `getMyReservations`. Each validates its input with a
schema and delegates to the same service the web UI calls, so the assistant
inherits the real rules for free — tenant isolation, the booking window, the
subscription gate, and the Postgres exclusion constraint that makes
double-booking impossible.

Three rules hold, and `tests/integration/assistant.test.ts` enforces them
rather than trusting the comments:

1. **No tool reaches the database.** There is no `db` import in that file, and
   a test strips the comments and asserts it stays that way. A model that can
   emit arbitrary arguments must not be one `where` clause away from the data.

2. **No tool decides availability.** `getAvailability` reports what the
   scheduling engine computed. `createReservation` re-validates server-side and
   refuses any instant the engine did not offer, so a hallucinated 3 a.m.
   appointment becomes a clean `SLOT_UNAVAILABLE` rather than a salon holding a
   chair at three in the morning. That case is a test.

3. **Booking is never implicit.** Every mutating tool requires `confirmed:
   true`, which the caller may set only after the human has agreed out loud. A
   model that forgets gets `NOT_CONFIRMED` and an instruction to ask first.

Mutating tools are additionally closed to anonymous callers, and ownership is
the service's business, not the assistant's — a test confirms one customer
cannot cancel another's appointment through the tool layer.

## Vendor seams

`src/server/providers/voice.ts` defines `SpeechToTextProvider`,
`LanguageModelProvider` and `TextToSpeechProvider`, mirroring the existing
`MapProvider` and storage-driver pattern. No vendor is named in application
code, and a test asserts that.

Every seam is unconfigured today and throws when called. `voiceEnabled()`
returns false, and the UI is expected to ask before offering a microphone, so
voice is *absent* where it is not configured rather than broken. A stub that
quietly returned an empty transcript is how a voice feature demos well and
fails in Sfax.

## What the avatar may never do

- **Block the interface.** The figure is `pointer-events: none`; a visitor who
  ignores it can search straight past it. Verified in a browser: the element
  under the avatar's centre is the container behind it.
- **Override motion preferences.** Under `prefers-reduced-motion` every pose
  collapses to the final one. The greeting still appears — it is information,
  not decoration.
- **Speak for the backend.** It reports outcomes; it does not determine them.

## The intended flow, when voice arrives

```
microphone → speech-to-text → model (+ tool catalogue)
           → callAssistantTool() → booking service → Postgres
           → model → text-to-speech → avatar SPEAKING
```

The avatar is a layer over the existing interface, not a separate chat page:
when it says it found three options, the three cards are what the normal search
UI would have rendered. The marketplace stays the product; the host makes it
feel Tunisian.
