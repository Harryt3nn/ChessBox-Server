/*packages/shared/src/schemas/connections.ts*/


import { z } from 'zod';

export const connectPlatformUsernameSchema = z
  .string()
  .min(1, 'Username is required')
  .max(50, 'Username must be at most 50 characters');

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