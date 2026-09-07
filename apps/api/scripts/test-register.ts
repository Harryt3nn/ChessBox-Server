// apps/api/scripts/test-register.ts


import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../src/routers/appRouter';


const client = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: 'http://localhost:3000/trpc' })],
});

const result = await client.auth.register.mutate({
  email: 'test@example.com',
  username: 'testuser',
  password: 'password123',
});

console.log(result);