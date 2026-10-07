import 'server-only';
import { AppError } from '@/lib/errors';

/**
 * Voice provider seams for the Zynetna concierge.
 *
 * The avatar is meant to become something a customer talks to, and the three
 * pieces that needs — speech in, reasoning, speech out — are the fastest
 * moving and most expensive parts of the stack. So none of them is named
 * anywhere in the application: feature code depends on these interfaces, and
 * which vendor fulfils them is a configuration decision, exactly as with
 * `MapProvider` and the storage driver.
 *
 * Nothing is implemented here yet, deliberately. Shipping a provider we have
 * not chosen would be guessing at an API, and the unconfigured default below
 * fails loudly rather than pretending to transcribe — a silent stub is how a
 * voice feature ends up appearing to work in a demo and failing in Sfax.
 */

/** A transcript, with the language actually detected. */
export type Transcription = {
  text: string;
  /**
   * BCP-47 as reported by the provider. Tunisian Arabic usually arrives as
   * `ar-TN`, sometimes `ar`, and code-switched speech is often tagged by the
   * dominant language — so callers treat this as a hint, not a guarantee.
   */
  language: string;
  confidence?: number;
};

export interface SpeechToTextProvider {
  readonly name: string;
  /**
   * `hints` carries the languages a Tunisian speaker is likely to mix, which
   * most providers accept and which materially improves code-switched speech.
   */
  transcribe(audio: ArrayBuffer, hints?: { languages?: string[] }): Promise<Transcription>;
}

/** A model turn: either something to say, or tools it wants called. */
export type AssistantTurn = {
  say?: string;
  toolCalls?: { name: string; input: unknown }[];
};

export interface LanguageModelProvider {
  readonly name: string;
  /**
   * The model is given the conversation and the tool catalogue, and may reply
   * or ask for tools. It never receives database access, and the caller — not
   * the model — decides whether a requested tool actually runs.
   */
  respond(input: {
    system: string;
    messages: { role: 'user' | 'assistant' | 'tool'; content: string; toolName?: string }[];
    tools: { name: string; description: string; parameters: unknown }[];
    locale: string;
  }): Promise<AssistantTurn>;
}

export type SpokenAudio = {
  audio: ArrayBuffer;
  mimeType: string;
  /**
   * Word timings, when the provider gives them. The avatar's SPEAKING state
   * can drive real lip-sync from these instead of a generic mouth loop.
   */
  marks?: { time: number; value: string }[];
};

export interface TextToSpeechProvider {
  readonly name: string;
  speak(text: string, options: { locale: string; voice?: string }): Promise<SpokenAudio>;
}

/**
 * The default for every seam until one is configured.
 *
 * It throws. A voice feature that degrades quietly is worse than one that is
 * plainly switched off: the UI can check `voiceEnabled()` and simply not offer
 * the microphone.
 */
function unconfigured(part: string): never {
  throw new AppError(
    'INTERNAL',
    `No ${part} provider is configured. Set the provider environment variables before enabling voice.`,
  );
}

class UnconfiguredSpeechToText implements SpeechToTextProvider {
  readonly name = 'unconfigured';
  transcribe(): Promise<Transcription> {
    unconfigured('speech-to-text');
  }
}

class UnconfiguredLanguageModel implements LanguageModelProvider {
  readonly name = 'unconfigured';
  respond(): Promise<AssistantTurn> {
    unconfigured('language model');
  }
}

class UnconfiguredTextToSpeech implements TextToSpeechProvider {
  readonly name = 'unconfigured';
  speak(): Promise<SpokenAudio> {
    unconfigured('text-to-speech');
  }
}

export function speechToTextProvider(): SpeechToTextProvider {
  return new UnconfiguredSpeechToText();
}

export function languageModelProvider(): LanguageModelProvider {
  return new UnconfiguredLanguageModel();
}

export function textToSpeechProvider(): TextToSpeechProvider {
  return new UnconfiguredTextToSpeech();
}

/**
 * Whether the voice concierge can actually run.
 *
 * The UI asks this before offering a microphone, so the feature is absent
 * rather than broken wherever it is not configured.
 */
export function voiceEnabled(): boolean {
  return (
    speechToTextProvider().name !== 'unconfigured' &&
    languageModelProvider().name !== 'unconfigured' &&
    textToSpeechProvider().name !== 'unconfigured'
  );
}
