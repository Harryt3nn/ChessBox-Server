/* apps/api/src/auth/token.ts */

import jwt from 'jsonwebtoken';
import { env } from '../env';
import type { PrismaClient } from '../generated/prisma/client';

// D43: a token carries the user's tokenVersion as `ver`; bumping the version (password change)
// makes every older token fail the check below
export function signToken(userId: string, tokenVersion: number) {
  return jwt.sign({ sub: userId, ver: tokenVersion }, env.jwtSecret, { expiresIn: '3d' });
}

/** the user id a bearer header proves, or null if it's missing, invalid, expired or revoked */
export async function userIdFromHeader(prisma: Pick<PrismaClient, 'user'>, authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) return null;

  let payload: { sub: string; ver?: number };
  try {
    payload = jwt.verify(authHeader.slice(7), env.jwtSecret) as typeof payload;
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { tokenVersion: true } });
  // tokens signed before D43 have no `ver` and count as version 0, so the deploy signs nobody out.
  // A deleted account still gets its id through: procedures answer NOT_FOUND, which the desktop
  // signs out on (D13)
  if (user && user.tokenVersion !== (payload.ver ?? 0)) return null;
  return payload.sub;
}
