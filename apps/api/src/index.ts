/* apps/api/src/index.ts */

import { buildApp } from './app';

const fastify = await buildApp({ logger: true });

try {
  await fastify.listen({ port: 3001, host: '0.0.0.0' });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
