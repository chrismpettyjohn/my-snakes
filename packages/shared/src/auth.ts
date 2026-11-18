import {z} from 'zod';

export const DiscordLoginInput = z.object({code: z.string().min(1).max(200)});
export type DiscordLoginInput = z.infer<typeof DiscordLoginInput>;

export interface User {
  id: string;
  username: string | null;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}
