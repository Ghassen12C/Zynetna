import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Time-based one-time passwords (RFC 6238, built on RFC 4226 HOTP), the codes
 * Google Authenticator, Microsoft Authenticator and similar apps show.
 *
 * SHA-1, 6 digits and 30-second steps are what those apps assume when a QR
 * code does not say otherwise, so they are fixed here.
 */
export const TOTP_DIGITS = 6;
export const TOTP_STEP_SECONDS = 30;
/** Accept the previous and next step too, for phone clocks a little off. */
export const TOTP_WINDOW = 1;

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32.charAt((value >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32.charAt((value << (5 - bits)) & 31);
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** RFC 4226 HOTP value for one counter, as a zero-padded string. */
export function hotp(secret: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', secret).update(message).digest();
  const offset = mac.readUInt8(mac.length - 1) & 0xf;
  const binary = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export function stepAt(time: Date | number): number {
  const ms = typeof time === 'number' ? time : time.getTime();
  return Math.floor(ms / 1000 / TOTP_STEP_SECONDS);
}

export function totp(secret: Buffer, time: Date | number, digits = TOTP_DIGITS): string {
  return hotp(secret, stepAt(time), digits);
}

/**
 * The step a code matches, or null. A step at or before `lastStep` is refused,
 * so a code seen over someone's shoulder cannot be used a second time.
 */
export function matchTotp(
  secret: Buffer,
  code: string,
  time: Date | number,
  lastStep: number | null = null,
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = stepAt(time);
  for (let delta = -TOTP_WINDOW; delta <= TOTP_WINDOW; delta += 1) {
    const step = now + delta;
    if (lastStep !== null && step <= lastStep) continue;
    const expected = Buffer.from(hotp(secret, step));
    if (timingSafeEqual(expected, Buffer.from(code))) return step;
  }
  return null;
}

/** The URI an authenticator app reads from the QR code. */
export function otpauthUri(issuer: string, account: string, secretBase32: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Keep digits only: people type codes with spaces ("123 456"). */
export function normalizeTotpInput(input: string): string {
  return input.replace(/\D/g, '');
}
