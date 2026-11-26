import { afterAll, describe, expect, it, vi } from 'vitest';

// env.ts reads NODE_ENV once at import, so production mode is set before the app loads.
// Vitest gives each test file its own modules, so the other files stay in dev mode.
vi.stubEnv('NODE_ENV', 'production');
const { buildApp } = await import('../app');

const app = await buildApp({ logger: false });
afterAll(() => app.close());

describe('errors in production', () => {
  // the test DATABASE_URL points at nothing, so login fails with a real database error
  it('hides a database error behind a generic message, with no stack trace', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/trpc/auth.login',
      payload: JSON.stringify({ username: 'harry', password: 'password1' }),
      headers: { 'content-type': 'application/json' },
      remoteAddress: '10.30.0.1',
    });

    expect(res.statusCode).toBe(500);
    const { error } = res.json();
    expect(error.message).toBe('Something went wrong. Please try again.');
    expect(error.data.stack).toBeUndefined();
    expect(res.body).not.toMatch(/prisma|ECONNREFUSED|\.ts\b|node_modules/i);
  });
});
