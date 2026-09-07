/*apps/api/src/routers/auth.ts*/

import { TRPCError } from '@trpc/server';
import jwt from 'jsonwebtoken';
import { loginInputSchema, registerInputSchema } from '@chessbox/shared';
import { hashPassword, verifyPassword } from '../auth/password';
import { router, publicProcedure, protectedProcedure } from '../trpc';

function signToken(userId: string) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET!, { expiresIn: '3d' });
}

// Constant-format hash used to verify against when no user is found, so
// login takes the same ~300ms whether or not the username exists. Any
// valid-format hash works here — the password inside doesn't matter.
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export const authRouter = router({
  register: publicProcedure.input(registerInputSchema).mutation(async ({ input, ctx }) => {
      const existing = await ctx.prisma.user.findFirst({
        where: { OR: [{ email: input.email }, { username: input.username }] },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: existing.email === input.email ? 'Email already in use' : 'Username already taken',
        });
      }

      const passwordHash = await hashPassword(input.password);

      const user = await ctx.prisma.user.create({
        data: { email: input.email, username: input.username, passwordHash },
      });

      return {
        token: signToken(user.id),
        user: { id: user.id, username: user.username, email: user.email },
      };
    }),

  login: publicProcedure.input(loginInputSchema).mutation(async ({ input, ctx }) => {
    let user;
    try{
       user = await ctx.prisma.user.findUnique(
        {where: { username: input.username }});
    }
    catch(err){
      console.error('Login error:', err);
      throw err;
    }
      const valid = user
        ? await verifyPassword(input.password, user.passwordHash)
        : await verifyPassword(input.password, DUMMY_HASH);

      if (!user || !valid) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
      }

      return {
        token: signToken(user.id),
        user: { id: user.id, username: user.username },
      };
    }),

   me: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { id: true, username: true, email: true, lichessName: true, chesscomName: true },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return user;
    }),
});