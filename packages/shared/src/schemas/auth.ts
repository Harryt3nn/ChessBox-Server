/*packages/shared/src/schemas/auth.ts*/


import { z } from 'zod';
import blacklist from '../data/blacklist.json';


const combinedBlacklist = [
  ...blacklist.system,
  ...blacklist.app,
  ...blacklist.chess,
].map((word) => word.toLowerCase());

export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[A-Za-z0-9_-]+$/, 'Username can only contain letters, numbers, _ and -')
  .refine(
    (username) => !combinedBlacklist.includes(username.toLowerCase()),
    { message: 'This username is not allowed' }
  );



  export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(64, 'Password must be at most 64 characters');

  export const loginInputSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});
export type LoginInput = z.infer<typeof loginInputSchema>;


export const loginOutputSchema = z.object({
  user: z.object({
    id: z.string(),
    username: z.string(),
  }),
  token: z.string(),
});
export type LoginOutput = z.infer<typeof loginOutputSchema>;

export const emailSchema = z.string().email();

export const registerInputSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
});


export type RegisterInput = z.infer<typeof registerInputSchema>;

export const registerOutputSchema = z.object({
  user: z.object({
    id: z.string(),
    username: z.string(),
    email: z.string(),
  }),
  token: z.string(),
});
export type RegisterOutput = z.infer<typeof registerOutputSchema>;