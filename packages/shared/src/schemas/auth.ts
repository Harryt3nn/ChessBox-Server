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

// the current password is only checked against the stored hash, so it isn't held to today's
// password rules (an old password may predate them); the length cap still stops huge inputs
const currentPasswordSchema = z
  .string()
  .min(1, 'Enter your current password')
  .max(64, 'Password must be at most 64 characters');

export const changePasswordInputSchema = z.object({
  currentPassword: currentPasswordSchema,
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

// D43: the password change revokes every token, so the caller must swap in this one
export const changePasswordOutputSchema = z.object({
  ok: z.literal(true),
  token: z.string(),
});
export type ChangePasswordOutput = z.infer<typeof changePasswordOutputSchema>;

export const changeUsernameInputSchema = z.object({
  password: currentPasswordSchema,
  newUsername: usernameSchema,
});
export type ChangeUsernameInput = z.infer<typeof changeUsernameInputSchema>;
