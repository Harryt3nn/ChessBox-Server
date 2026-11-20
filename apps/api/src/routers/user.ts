/*apps/api/src/routers/user.ts*/

import { router, protectedProcedure } from "../trpc";

// only ever select the fields the client needs -- a bare findUnique would also send passwordHash
export const userRouter = router({me: protectedProcedure.query(async ({ ctx }) =>
  {
    return ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { id: true, username: true, email: true, lichessName: true, chesscomName: true },
    });
  }
),});
