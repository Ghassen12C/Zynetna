import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    hookTimeout: 30000,
    testTimeout: 30000,
    pool: 'forks',
    // Integration tests share one database and truncate between suites, so
    // they must not run concurrently.
    poolOptions: { forks: { singleFork: true } },
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgresql://zynetna:zynetna_dev@127.0.0.1:5432/zynetna_test?schema=public',
      SESSION_SECRET: 'test-session-secret-at-least-32-characters-long',
      JOB_TOKEN: 'test-job-token-value',
      STORAGE_DRIVER: 'local',
      STORAGE_LOCAL_DIR: './storage-test',
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Tests exercise server modules directly. Next's bundler maps
      // `server-only` to an empty module for server code; Vitest has no such
      // mapping, so point it at the package's own empty build rather than its
      // throwing one. The guard still protects the client bundle, which is the
      // only place it matters.
      'server-only': fileURLToPath(
        new URL('./node_modules/server-only/empty.js', import.meta.url),
      ),
    },
  },
});
