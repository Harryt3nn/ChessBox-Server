/* apps/api/src/index.ts */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { env } from './env';
import { appRouter } from './routers/appRouter';
import { createContext } from './trpc';
import { limits } from './security/rateLimit';

const fastify = Fastify({
  logger: true,
  // tRPC payloads here are tiny -- reject anything large before it is parsed
  bodyLimit: 64 * 1024,
});

// only listed origins may call the API from a browser context
// requests with no Origin header (curl, server-to-server) aren't affected by CORS anyway
await fastify.register(cors, {
  origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)),
});

// blanket per-IP limit on every request; individual auth actions have tighter limits of their own
fastify.addHook('onRequest', async (req, reply) => {
  const retryMs = limits.global.hit(req.ip);
  if (retryMs > 0) {
    reply.header('Retry-After', Math.ceil(retryMs / 1000));
    return reply.code(429).send({ error: 'Too many requests' });
  }
});

fastify.addHook('onSend', async (_req, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('Cache-Control', 'no-store');
});

fastify.get('/', async () => ({ ok: true }));

fastify.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: {
    router: appRouter,
    createContext,
    // a batched request runs every call inside it -- cap how many one request can carry
    maxBatchSize: 10,
  },
});

try {
  await fastify.listen({ port: 3001, host: '0.0.0.0' });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
