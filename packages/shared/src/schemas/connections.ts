/*packages/shared/src/schemas/connections.ts*/


import { z } from 'zod';

// Lichess and Chess.com usernames only use letters, numbers, _ and -
// enforcing that here also stops anything else being smuggled into the upstream API URL
export const connectPlatformUsernameSchema = z
  .string()
  .trim()
  .min(1, 'Username is required')
  .max(50, 'Username must be at most 50 characters')
  .regex(/^[A-Za-z0-9_-]+$/, 'Username can only contain letters, numbers, _ and -');

export const connectLichessInputSchema = z.object({
  username: connectPlatformUsernameSchema,
});
export type ConnectLichessInput = z.infer<typeof connectLichessInputSchema>;

export const connectChesscomInputSchema = z.object({
  username: connectPlatformUsernameSchema,
});
export type ConnectChesscomInput = z.infer<typeof connectChesscomInputSchema>;

export const connectOutputSchema = z.object({
  success: z.literal(true),
  username: z.string(),
});
export type ConnectOutput = z.infer<typeof connectOutputSchema>;