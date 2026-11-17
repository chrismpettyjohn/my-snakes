import { z } from "zod";

export const DeviceKind = z.enum(["herpstat", "govee"]);
export type DeviceKind = z.infer<typeof DeviceKind>;

/** host = LAN IP/hostname for /RAWSTATUS polling (API must be on the same network). */
const Host = z.string().regex(/^[A-Za-z0-9.-]+(:\d+)?$/, "IP or hostname, e.g. 192.168.1.141").max(100);
const DeviceName = z.string().min(1).max(80);

export const CreateHerpstatInput = z.object({ name: DeviceName, host: Host.optional() });
export type CreateHerpstatInput = z.infer<typeof CreateHerpstatInput>;

export const UpdateDeviceInput = z.object({ name: DeviceName.optional(), host: Host.nullable().optional() });
export type UpdateDeviceInput = z.infer<typeof UpdateDeviceInput>;

export const SetGoveeKeyInput = z.object({ apiKey: z.string().min(10).max(200), email: z.string().email().max(200) });
export type SetGoveeKeyInput = z.infer<typeof SetGoveeKeyInput>;

/**
 * Every enclosure has four zones: warm & cold ambient (air sensors) and the basking bulb & RHP
 * (thermostat outputs, which also report power %).
 */
export const SensorRole = z.enum(["warm", "cold", "bask", "rhp"]);
export type SensorRole = z.infer<typeof SensorRole>;
export const SENSOR_ROLES: readonly SensorRole[] = SensorRole.options;
export const ROLE_LABEL: Record<SensorRole, string> = {
  warm: "Warm Ambient", cold: "Cold Ambient", bask: "Basking", rhp: "RHP",
};
/** Thermostat outputs drive the heat zones; air sensors read the ambient ones. */
export const ROLE_KIND: Record<SensorRole, DeviceKind> = { warm: "govee", cold: "govee", bask: "herpstat", rhp: "herpstat" };
export const rolesFor = (kind: DeviceKind): SensorRole[] => SENSOR_ROLES.filter((r) => ROLE_KIND[r] === kind);

/**
 * Sets which snakes one device channel (Herpstat output / Govee sensor) serves.
 * Many-to-many: a snake can have several outputs (bask + RHP); one output can serve a rack of snakes.
 */
export const AssignSensorInput = z.object({
  deviceId: z.string().uuid(),
  channel: z.string().min(1).max(40),
  snakeIds: z.array(z.string().uuid()).max(500),
  /** Which zone of those snakes' enclosures this channel measures. */
  role: SensorRole.nullable().optional(),
});
export type AssignSensorInput = z.infer<typeof AssignSensorInput>;

/** A Govee sensor reports on a single channel. */
export const GOVEE_CHANNEL = "main";

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
  host: string | null;
  firmware: string | null;
  lastError: string | null;
  /** Herpstat upload credentials; only sent to owners. */
  uploadUrl?: string;
  apiKey?: string;
  channels: DeviceChannel[];
}

export interface GoveeAccount {
  configured: boolean;
  email: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
}

export interface DeviceList { govee: GoveeAccount; devices: Device[] }

export interface UploadCredentials { uploadUrl: string; apiKey: string }

/** A SpyderWeb unit found on the API host's LAN. */
export interface FoundHerpstat { host: string; mac: string; name: string }
