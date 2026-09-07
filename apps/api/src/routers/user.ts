/*apps/api/src/routers/user.ts*/

import { router, protectedProcedure } from "../trpc";

export const userRouter = router({me: protectedProcedure.query(async ({ ctx }) => 
  {
    return ctx.prisma.user.findUnique({where: { id: ctx.userId }});
  }
),});