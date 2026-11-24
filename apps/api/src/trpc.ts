/*apps/api/src/trpc.ts*/

import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { ZodError } from 'zod';
import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env';
import { userIdFromHeader } from './auth/token';
import type { RateLimiter } from './security/rateLimit';

const adapter = new PrismaPg({ connectionString: env.databaseUrl });
const prisma = new PrismaClient({ adapter });

export type Context = Awaited<ReturnType<typeof createContext>>;

export async function createContext({ req }: CreateFastifyContextOptions) {
  const userId = await userIdFromHeader(prisma, req.headers.authorization);
  return { prisma, userId, ip: req.ip };
}

const t = initTRPC.context<Context>().create({
  // stack traces are only sent to the client outside production
  isDev: !env.isProduction,
  errorFormatter({ shape, error }) {
    // input validation: send the first readable message instead of the raw JSON issue list
    if (error.code === 'BAD_REQUEST' && error.cause instanceof ZodError) {
      return { ...shape, message: error.cause.issues[0]?.message ?? 'Invalid input' };
    }

    // unexpected errors can carry database / internal details -- hide them in production
    if (error.code === 'INTERNAL_SERVER_ERROR' && env.isProduction) {
      return { ...shape, message: 'Something went wrong. Please try again.' };
    }

    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

/** throws TOO_MANY_REQUESTS if `limiter` is over its limit for `key` */
export function enforceLimit(limiter: RateLimiter, key: string) {
  const retryMs = limiter.hit(key);
  if (retryMs > 0) {
    const minutes = Math.ceil(retryMs / 60_000);
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    });
  }
}
