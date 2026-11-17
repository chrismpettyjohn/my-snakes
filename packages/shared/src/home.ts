import {z} from 'zod';
import type {User} from './auth';

export const HomeRole = z.enum(['owner', 'member']);
export type HomeRole = z.infer<typeof HomeRole>;

export const CreateHomeInput = z.object({name: z.string().min(1).max(80)});
export type CreateHomeInput = z.infer<typeof CreateHomeInput>;

export const CollectionIcon = z.enum([
  'house',
  'bedroom',
  'living',
  'office',
  'upstairs',
  'basement',
  'garage',
  'closet',
  'rack',
  'breeding',
  'quarantine',
  'building',
]);
export type CollectionIcon = z.infer<typeof CollectionIcon>;
export const CollectionColor = z.enum(['indigo', 'blue', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'gray']);
export type CollectionColor = z.infer<typeof CollectionColor>;

export const UpdateHomeInput = CreateHomeInput.extend({icon: CollectionIcon.optional(), color: CollectionColor.optional()});
export type UpdateHomeInput = z.infer<typeof UpdateHomeInput>;

export const InviteMemberInput = z.object({email: z.string().email()});
export type InviteMemberInput = z.infer<typeof InviteMemberInput>;

export interface Home {
  id: string;
  name: string;
  icon: CollectionIcon;
  color: CollectionColor;
  role: HomeRole;
}

export interface Member extends User {
  role: HomeRole;
}
