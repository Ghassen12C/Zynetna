import { isProd, isTest } from './env';

type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN = isTest ? ORDER.error : isProd ? ORDER.info : ORDER.debug;

/** Keys whose values are never written to a log line. */
const REDACT = new Set([
  'password',
  'passwordHash',
  'token',
  'tokenHash',
  'secret',
  'authorization',
  'cookie',
  'sessionToken',
]);

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT.has(k) ? '[redacted]' : scrub(v, depth + 1);
  }
  return out;
}

function emit(level: Level, message: string, context?: Record<string, unknown>) {
  if (ORDER[level] < MIN) return;
  const line = {
    level,
    time: new Date().toISOString(),
    message,
    ...(context ? (scrub(context) as Record<string, unknown>) : {}),
  };
  const serialised = isProd ? JSON.stringify(line) : `[${level}] ${message}` +
    (context ? ` ${JSON.stringify(scrub(context))}` : '');
  if (level === 'error') console.error(serialised);
  else if (level === 'warn') console.warn(serialised);
  else console.log(serialised);
}

export const logger = {
  debug: (m: string, c?: Record<string, unknown>) => emit('debug', m, c),
  info: (m: string, c?: Record<string, unknown>) => emit('info', m, c),
  warn: (m: string, c?: Record<string, unknown>) => emit('warn', m, c),
  error: (m: string, c?: Record<string, unknown>) => emit('error', m, c),
};
