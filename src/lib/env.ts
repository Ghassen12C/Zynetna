import 'server-only';
import { z } from 'zod';

/**
 * Environment is validated once, at module load, and fails loudly.
 * A missing secret must stop the process — never degrade silently into an
 * insecure default.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  APP_NAME: z.string().default('Zynetna'),

  DATABASE_URL: z.string().min(1),

  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),

  STORAGE_DRIVER: z.enum(['local', 'azure']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./storage'),
  STORAGE_PUBLIC_BASE_URL: z.string().default('/media'),
  AZURE_STORAGE_CONNECTION_STRING: z.string().optional(),
  AZURE_STORAGE_CONTAINER: z.string().default('zynetna-media'),

  EMAIL_DRIVER: z.enum(['console', 'smtp', 'resend']).default('console'),
  EMAIL_FROM: z.string().default('Zynetna <no-reply@zynetna.tn>'),
  SMTP_URL: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SMS_DRIVER: z.enum(['console']).default('console'),

  PAYMENT_DRIVER: z.enum(['manual']).default('manual'),

  MAP_PROVIDER: z.enum(['osm', 'azure', 'mapbox', 'google']).default('osm'),
  MAP_API_KEY: z.string().optional(),

  JOB_TOKEN: z.string().min(16).default('dev-job-token-change-me'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** Azure Blob requires a connection string; refuse to boot half-configured. */
if (env.STORAGE_DRIVER === 'azure' && !env.AZURE_STORAGE_CONNECTION_STRING) {
  throw new Error('STORAGE_DRIVER=azure requires AZURE_STORAGE_CONNECTION_STRING');
}
if (env.EMAIL_DRIVER === 'resend' && !env.RESEND_API_KEY) {
  throw new Error('EMAIL_DRIVER=resend requires RESEND_API_KEY');
}
if (isProd && env.SESSION_SECRET.includes('replace-me')) {
  throw new Error('SESSION_SECRET still holds its placeholder value in production');
}
// Links in e-mails, QR codes and calendar files are built from APP_URL; a
// production server that still believes it lives on localhost would mail out
// dead links. `next build` also runs with NODE_ENV=production, so the check
// only applies to a running server.
if (isProd && process.env.NEXT_PHASE !== 'phase-production-build') {
  if (/localhost|127\.0\.0\.1/.test(env.APP_URL)) {
    throw new Error('APP_URL points at localhost in production; set the public origin');
  }
  if (env.JOB_TOKEN === 'dev-job-token-change-me') {
    throw new Error('JOB_TOKEN still holds its development value in production');
  }
}
