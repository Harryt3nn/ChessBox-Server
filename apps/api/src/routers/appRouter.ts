/*apps/api/src/routers/appRouter.ts*/

import { router } from '../trpc';
import { authRouter } from './auth';
import { userRouter } from "./user";
import { connectionsRouter } from './connection';

export const appRouter = router({
  user: userRouter,
  auth: authRouter,
  connections: connectionsRouter,
});

export type AppRouter = typeof appRouter;