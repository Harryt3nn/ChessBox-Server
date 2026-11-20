/*apps/api/src/routers/connection.ts*/

import { TRPCError } from '@trpc/server';
import { connectLichessInputSchema, connectChesscomInputSchema } from '@chessbox/shared';
import { router, protectedProcedure, enforceLimit } from '../trpc';
import { limits } from '../security/rateLimit';

const UPSTREAM_TIMEOUT_MS = 8_000;

const PLATFORMS = {
  lichess: { label: 'Lichess', profileUrl: (u: string) => `https://lichess.org/api/user/${u}` },
  chesscom: { label: 'Chess.com', profileUrl: (u: string) => `https://api.chess.com/pub/player/${u}` },
} as const;

// checks the account exists on the platform before saving it
async function assertAccountExists(platform: keyof typeof PLATFORMS, username: string) {
  const { label, profileUrl } = PLATFORMS[platform];
  let response: Response;

  try {
    // the schema already restricts usernames to [A-Za-z0-9_-]; encoding is a second line of defence
    response = await fetch(profileUrl(encodeURIComponent(username)), {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    throw new TRPCError({ code: 'BAD_GATEWAY', message: `Failed to reach ${label}` });
  }

  if (!response.ok) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `${label} account not found` });
  }
}

export const connectionsRouter = router({
  connectLichess: protectedProcedure
    .input(connectLichessInputSchema)
    .mutation(async ({ input, ctx }) => {
      enforceLimit(limits.connectByUser, ctx.userId);
      await assertAccountExists('lichess', input.username);

      try {
        await ctx.prisma.user.update({
          where: { id: ctx.userId },
          data: { lichessName: input.username },
        });
      } catch (err) {
        console.error('Failed to save lichessName:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to save username',
        });
      }

      return { success: true as const, username: input.username };
    }),

  connectChesscom: protectedProcedure
    .input(connectChesscomInputSchema)
    .mutation(async ({ input, ctx }) => {
      enforceLimit(limits.connectByUser, ctx.userId);
      await assertAccountExists('chesscom', input.username);

      try {
        await ctx.prisma.user.update({
          where: { id: ctx.userId },
          data: { chesscomName: input.username },
        });
      } catch (err) {
        console.error('Failed to save chesscomName:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to save username',
        });
      }

      return { success: true as const, username: input.username };
    }),
});
