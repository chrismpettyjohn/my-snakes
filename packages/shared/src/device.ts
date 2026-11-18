import {z} from 'zod';
import type {Snake} from './husbandry';

export const DeviceKind = z.enum(['herpstat', 'govee']);
export type DeviceKind = z.infer<typeof DeviceKind>;

export const WebhookProviderName = z.enum(['herpstat']);
export type WebhookProviderName = z.infer<typeof WebhookProviderName>;

const DeviceName = z.string().min(1).max(80);

export const CreateHerpstatInput = z.object({name: DeviceName});
export type CreateHerpstatInput = z.infer<typeof CreateHerpstatInput>;

export const UpdateDeviceInput = z.object({name: DeviceName});
export type UpdateDeviceInput = z.infer<typeof UpdateDeviceInput>;

export const SetGoveeKeyInput = z.object({apiKey: z.string().min(10).max(200), email: z.string().email().max(200)});
export type SetGoveeKeyInput = z.infer<typeof SetGoveeKeyInput>;

export const SensorRole = z.enum(['warm', 'cold', 'bask', 'rhp']);
export type SensorRole = z.infer<typeof SensorRole>;
export const SENSOR_ROLES: readonly SensorRole[] = SensorRole.options;
export const ROLE_LABEL: Record<SensorRole, string> = {
  warm: 'Warm Ambient',
  cold: 'Cold Ambient',
  bask: 'Basking',
  rhp: 'RHP',
};
export const ROLE_KIND: Record<SensorRole, DeviceKind> = {warm: 'govee', cold: 'govee', bask: 'herpstat', rhp: 'herpstat'};
export const rolesFor = (kind: DeviceKind): SensorRole[] => SENSOR_ROLES.filter(r => ROLE_KIND[r] === kind);

export const AssignSensorInput = z.object({
  deviceId: z.string().uuid(),
  channel: z.string().min(1).max(40),
  snakeIds: z.array(z.string().uuid()).max(500),
  role: SensorRole.nullable().optional(),
});
export type AssignSensorInput = z.infer<typeof AssignSensorInput>;

export const GOVEE_CHANNEL = 'main';

export interface DeviceChannel {
  channel: string;
  label: string | null;
  snakeIds: string[];
  role: SensorRole | null;
}

export interface Device {
  id: string;
  kind: DeviceKind;
  name: string;
  model: string | null;
  externalId: string | null;
  lastSeenAt: string | null;
  firmware: string | null;
  lastError: string | null;
  webhooks?: Webhook[];
  channels: DeviceChannel[];
}

export interface GoveeAccount {
  configured: boolean;
  email: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
}

export type LinkableSnake = Snake & {collection: string};

export interface DeviceList {
  govee: GoveeAccount;
  devices: Device[];
  snakes: LinkableSnake[];
}

export interface Webhook {
  id: string;
  provider: WebhookProviderName;
  url: string;
  apiKey: string;
  createdAt: string;
  lastReceivedAt: string | null;
}

export interface CreatedHerpstat {
  id: string;
  webhook: Webhook;
}
