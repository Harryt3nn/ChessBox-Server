/*apps/api/src/routers/user.ts*/

import { TRPCError } from '@trpc/server';
import { changePasswordInputSchema, changeUsernameInputSchema } from '@chessbox/shared';
import { Prisma } from '../generated/prisma/client';
import { hashPassword, verifyPassword } from '../auth/password';
import { router, protectedProcedure, enforceLimit, type Context } from '../trpc';
import { limits, loginKey } from '../security/rateLimit';

// D28: changing login details re-asks the password. These tries share the login limit (D26),
// so the form can't be used to guess the password faster than the login screen can.
async function confirmPassword(ctx: Context & { userId: string }, password: string) {
  const user = await ctx.prisma.user.findUnique({ where: { id: ctx.userId } });
  if (!user) throw new TRPCError({ code: 'NOT_FOUND' });

  const limitKey = loginKey(ctx.ip, user.username);
  enforceLimit(limits.login, limitKey);
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Current password is incorrect' });
  }
  limits.login.reset(limitKey);
  return user;
}

export const userRouter = router({
  // only ever select the fields the client needs -- a bare findUnique would also send passwordHash
  me: protectedProcedure.query(async ({ ctx }) =>
    ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { id: true, username: true, email: true, lichessName: true, chesscomName: true },
    }),
  ),

  // D27: other devices stay signed in until their token expires (revisit before leaving Tailscale)
  changePassword: protectedProcedure.input(changePasswordInputSchema).mutation(async ({ input, ctx }) => {
    await confirmPassword(ctx, input.currentPassword);
    await ctx.prisma.user.update({
      where: { id: ctx.userId },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });
    return { ok: true as const };
  }),

  // the token holds the user id, not the name, so it stays valid after a rename
  changeUsername: protectedProcedure.input(changeUsernameInputSchema).mutation(async ({ input, ctx }) => {
    const user = await confirmPassword(ctx, input.password);
    if (input.newUsername === user.username) return { username: user.username };

    try {
      await ctx.prisma.user.update({ where: { id: ctx.userId }, data: { username: input.newUsername } });
    } catch (err) {
      // the unique index is the check, so two people claiming one name at once can't both win
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new TRPCError({ code: 'CONFLICT', message: 'Username already taken' });
      }
      throw err;
    }
    return { username: input.newUsername };
  }),
});
