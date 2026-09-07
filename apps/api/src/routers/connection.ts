/*apps/api/src/routers/connection.ts*/

import { TRPCError } from '@trpc/server';
import { connectLichessInputSchema, connectChesscomInputSchema } from '@chessbox/shared';
import { router, protectedProcedure } from '../trpc';

export const connectionsRouter = router({
  connectLichess: protectedProcedure
    .input(connectLichessInputSchema)
    .mutation(async ({ input, ctx }) => {
      let response: Response;

      try {
        response = await fetch(`https://lichess.org/api/user/${input.username}`);
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reach Lichess',
        });
      }

      if (!response.ok) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Lichess account not found',
        });
      }

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
      let response: Response;

      try {
        response = await fetch(`https://api.chess.com/pub/player/${input.username}`);
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reach Chess.com',
        });
      }

      if (!response.ok) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chess.com account not found',
        });
      }

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