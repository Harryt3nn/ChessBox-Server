import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // env.ts refuses to load without these; tests use a fake database, so they're placeholders, not secrets
    env: { JWT_SECRET: 'test-only-secret', DATABASE_URL: 'postgresql://unused@localhost:5432/unused' },
    // every password check is a real Argon2id hash (~0.3 s), and the lockout tests make a dozen of them
    testTimeout: 30_000,
  },
});
