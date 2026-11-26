import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';

// T38 checks that need the real HTTP app (hooks, router options, tRPC adapter), driven with inject()

const app = await buildApp({ logger: false });
afterAll(() => app.close());

const batchPath = (procedure: string, n: number) => `/trpc/${Array(n).fill(procedure).join(',')}?batch=1`;
const batchBody = (n: number) => JSON.stringify(Object.fromEntries(Array.from({ length: n }, (_, i) => [i, { username: 'someone' }])));

describe('tRPC batches', () => {
  it('runs a batch whose path is over 100 chars instead of answering 414', async () => {
    const url = batchPath('connections.connectChesscom', 4);
    expect(url.length).toBeGreaterThan(100);
    const res = await app.inject({ method: 'POST', url, payload: batchBody(4), headers: { 'content-type': 'application/json' }, remoteAddress: '10.20.0.1' });
    // signed out, so every call answers UNAUTHORIZED, which proves all 4 reached tRPC
    expect(res.statusCode).toBe(401);
    expect(res.json().map((r: { error: { data: { code: string } } }) => r.error.data.code)).toEqual(Array(4).fill('UNAUTHORIZED'));
  });

  // the tRPC version of GraphQL aliases: many password guesses in one HTTP request
  it('counts every login in a batch against the login limit', async () => {
    const guesses = JSON.stringify(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, { username: 'harry', password: `wrong-guess-${i}` }])));
    const json = { 'content-type': 'application/json' };
    const batch = await app.inject({ method: 'POST', url: batchPath('auth.login', 10), payload: guesses, headers: json, remoteAddress: '10.20.0.5' });
    // the test database points at nothing, so a guess that got past the limiter ends in a database error
    expect(batch.json().map((r: { error: { data: { code: string } } }) => r.error.data.code)).toEqual(Array(10).fill('INTERNAL_SERVER_ERROR'));

    const res = await app.inject({ method: 'POST', url: '/trpc/auth.login', payload: JSON.stringify({ username: 'harry', password: 'wrong-guess-10' }), headers: json, remoteAddress: '10.20.0.5' });
    expect(res.statusCode).toBe(429);
    expect(res.json().error.data.code).toBe('TOO_MANY_REQUESTS');
  });

  it('refuses a batch of more than 10 calls', async () => {
    const res = await app.inject({ method: 'GET', url: batchPath('user.me', 11), remoteAddress: '10.20.0.2' });
    expect(res.statusCode).toBe(400);
  });
});

describe('spoofed IP headers', () => {
  it('ignores X-Forwarded-For, so a new value on every request never resets the per-IP limit', async () => {
    let first429 = 0;
    for (let i = 1; i <= 301 && !first429; i++) {
      const res = await app.inject({ method: 'GET', url: '/', remoteAddress: '10.20.0.3', headers: { 'x-forwarded-for': `198.51.100.${i % 250}`, 'x-real-ip': `198.51.100.${i % 250}` } });
      if (res.statusCode === 429) first429 = i;
    }
    expect(first429).toBe(301);
  });
});

describe('response headers', () => {
  it('marks every response uncacheable and unsniffable, with no framework banner', async () => {
    const res = await app.inject({ method: 'GET', url: '/', remoteAddress: '10.20.0.4' });
    expect(res.headers).toMatchObject({ 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
