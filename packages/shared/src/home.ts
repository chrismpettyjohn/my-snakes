import { z } from "zod";
import type { User } from "./auth";

/** A home ("collection") is the tenancy unit. */
export const HomeRole = z.enum(["owner", "member"]);
export type HomeRole = z.infer<typeof HomeRole>;

export const CreateHomeInput = z.object({ name: z.string().min(1).max(80) });
export type CreateHomeInput = z.infer<typeof CreateHomeInput>;

export const UpdateHomeInput = CreateHomeInput;
export type UpdateHomeInput = z.infer<typeof UpdateHomeInput>;

export const InviteMemberInput = z.object({ email: z.string().email() });
export type InviteMemberInput = z.infer<typeof InviteMemberInput>;

export interface Home {
  id: string;
  name: string;
  role: HomeRole;
}

export interface Member extends User { role: HomeRole }
