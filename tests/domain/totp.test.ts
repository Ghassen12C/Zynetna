import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  hotp,
  matchTotp,
  otpauthUri,
  stepAt,
  totp,
} from '@/domain/identity/totp';

// The shared secret of RFC 4226 / RFC 6238 Appendix B (SHA-1).
const SECRET = Buffer.from('12345678901234567890', 'ascii');

describe('TOTP (RFC 6238)', () => {
  it('matches the RFC 4226 HOTP test values', () => {
    expect([0, 1, 2, 3, 9].map((c) => hotp(SECRET, c))).toEqual([
      '755224',
      '287082',
      '359152',
      '969429',
      '520489',
    ]);
  });

  it('matches the RFC 6238 SHA-1 test values (8 digits)', () => {
    const cases: [number, string][] = [
      [59, '94287082'],
      [1111111109, '07081804'],
      [1111111111, '14050471'],
      [1234567890, '89005924'],
      [2000000000, '69279037'],
      [20000000000, '65353130'],
    ];
    for (const [seconds, code] of cases) {
      expect(totp(SECRET, seconds * 1000, 8)).toBe(code);
    }
  });

  it('round-trips base32 and decodes the RFC secret', () => {
    const encoded = base32Encode(SECRET);
    expect(encoded).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(base32Decode(encoded).equals(SECRET)).toBe(true);
    expect(base32Decode('gezd gnbv-gy3t qojq gezd gnbv gy3t qojq').equals(SECRET)).toBe(true);
  });

  it('accepts the current code and one step either side, nothing further', () => {
    const now = 1_700_000_000_000;
    const step = stepAt(now);
    expect(matchTotp(SECRET, totp(SECRET, now), now)).toBe(step);
    expect(matchTotp(SECRET, hotp(SECRET, step - 1), now)).toBe(step - 1);
    expect(matchTotp(SECRET, hotp(SECRET, step + 1), now)).toBe(step + 1);
    expect(matchTotp(SECRET, hotp(SECRET, step - 2), now)).toBeNull();
    expect(matchTotp(SECRET, hotp(SECRET, step + 2), now)).toBeNull();
  });

  it('refuses a code already used, and malformed input', () => {
    const now = 1_700_000_000_000;
    const code = totp(SECRET, now);
    const step = matchTotp(SECRET, code, now);
    expect(step).not.toBeNull();
    expect(matchTotp(SECRET, code, now, step)).toBeNull();
    expect(matchTotp(SECRET, '12345', now)).toBeNull();
    expect(matchTotp(SECRET, 'abcdef', now)).toBeNull();
  });

  it('builds an otpauth URI the apps understand', () => {
    const uri = otpauthUri('Zynetna', 'ghassen@zynetna.tn', 'JBSWY3DPEHPK3PXP');
    expect(uri).toBe(
      'otpauth://totp/Zynetna%3Aghassen%40zynetna.tn?secret=JBSWY3DPEHPK3PXP&issuer=Zynetna&algorithm=SHA1&digits=6&period=30',
    );
  });
});
