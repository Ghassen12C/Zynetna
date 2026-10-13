/**
 * Strips credentials out of text bound for the logs. Some errors quote the
 * request they failed on — fetch, for one, rejects an invalid header by
 * repeating its value — so an error message can carry an API key.
 */
export function redactSecrets(text: string, secrets: Array<string | undefined> = []): string {
  let out = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 8) out = out.split(secret).join('[redacted]');
  }
  return out.replace(/\b(Bearer|Basic)\s+[^\s"']+/gi, '$1 [redacted]');
}
