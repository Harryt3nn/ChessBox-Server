/* apps/api/src/index.ts */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter } from './routers/appRouter';
import { createContext } from './trpc';

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: true });

fastify.get('/', async () => ({ hello: 'world' }));

fastify.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: {
    router: appRouter,
    createContext,
  },
});

try {
  await fastify.listen({ port: 3001, host: '0.0.0.0' });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}