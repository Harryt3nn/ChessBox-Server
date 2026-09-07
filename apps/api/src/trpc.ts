/*apps/api/src/trpc.ts*/

import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { PrismaClient } from './generated/prisma/client';
import jwt from 'jsonwebtoken';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const t = initTRPC.context<Context>().create();

export type Context = Awaited<ReturnType<typeof createContext>>;
export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

export function createContext({ req }: CreateFastifyContextOptions) {
  const authHeader = req.headers.authorization;
  let userId: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string };
      userId = payload.sub;
    } catch {
      // invalid/expired token -- leave userId null
    }
  }

  return { prisma, userId };
}