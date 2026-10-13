import { describe, expect, it } from 'vitest';
import { redactSecrets } from '@/lib/redact';

describe('redactSecrets', () => {
  it('hides a bearer token quoted in an error, even with a stray line break', () => {
    const message = 'Headers.append: "Bearer \rre_abc123DEF456ghi" is an invalid header value.';
    const out = redactSecrets(message);
    expect(out).not.toContain('re_abc123DEF456ghi');
    expect(out).toContain('Bearer [redacted]');
  });

  it('hides a known secret wherever it appears', () => {
    const out = redactSecrets('key re_abc123DEF456ghi was refused', ['re_abc123DEF456ghi']);
    expect(out).toBe('key [redacted] was refused');
  });

  it('leaves ordinary messages alone', () => {
    expect(redactSecrets('API key is invalid', ['re_abc123DEF456ghi'])).toBe('API key is invalid');
  });

  it('ignores secrets too short to be real', () => {
    expect(redactSecrets('status ok', ['ok'])).toBe('status ok');
  });
});
