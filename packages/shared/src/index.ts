import { z } from "zod";

// ---------- Auth ----------
export const RegisterInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(60),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInput>;

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; displayName: string };
}

// ---------- Homes (tenancy unit) ----------
export const HomeRole = z.enum(["owner", "member"]);
export type HomeRole = z.infer<typeof HomeRole>;

export const CreateHomeInput = z.object({ name: z.string().min(1).max(80) });
export type CreateHomeInput = z.infer<typeof CreateHomeInput>;

export const InviteMemberInput = z.object({ email: z.string().email() });

export interface Home {
  id: string;
  name: string;
  role: HomeRole;
}

// ---------- Husbandry ----------
export const Sex = z.enum(["male", "female", "unknown"]);
export const UpsertSnakeInput = z.object({
  name: z.string().min(1).max(80),
  species: z.string().max(120).optional(),
  morph: z.string().max(200).optional(),
  sex: Sex.default("unknown"),
  hatchDate: z.string().date().nullable().optional(),
  notes: z.string().max(2000).optional(),
  /** Small JPEG data URL (resized client-side). */
  photo: z.string().startsWith("data:image/").max(400_000).nullable().optional(),
  /** Each snake is its own enclosure: alert thresholds live here (°F / %RH). */
  minTempF: z.number().nullable().optional(),
  maxTempF: z.number().nullable().optional(),
  minHumidity: z.number().nullable().optional(),
  maxHumidity: z.number().nullable().optional(),
});
export type UpsertSnakeInput = z.infer<typeof UpsertSnakeInput>;
/** Full display order of a home's snakes, first to last. */
export const ReorderSnakesInput = z.object({ ids: z.array(z.string().uuid()).max(500) });
export type ReorderSnakesInput = z.infer<typeof ReorderSnakesInput>;

export const LogEventType = z.enum(["feeding", "refused", "shed", "poop", "urates", "water", "weight", "cleaning", "note"]);
export type LogEventType = z.infer<typeof LogEventType>;
export const CreateLogInput = z.object({
  type: LogEventType,
  at: z.string().datetime().optional(),
  /** grams for weight; prey description lives in notes */
  value: z.number().nullable().optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateLogInput = z.infer<typeof CreateLogInput>;

// ---------- Devices ----------
export const DeviceKind = z.enum(["herpstat", "govee"]);
export type DeviceKind = z.infer<typeof DeviceKind>;

/** host = LAN IP/hostname for /RAWSTATUS polling (API must be on the same network). */
const Host = z.string().regex(/^[A-Za-z0-9.-]+(:\d+)?$/, "IP or hostname, e.g. 192.168.1.141").max(100);
export const CreateHerpstatInput = z.object({ name: z.string().min(1).max(80), host: Host.optional() });
export const UpdateDeviceInput = z.object({ name: z.string().min(1).max(80).optional(), host: Host.nullable().optional() });

export const SetGoveeKeyInput = z.object({ apiKey: z.string().min(10).max(200), email: z.string().email().max(200) });

/**
 * Sets which snakes one device channel (Herpstat output / Govee sensor) serves.
 * Many-to-many: a snake can have several outputs (bask + RHP); one output can serve a rack of snakes.
 */
/**
 * Every enclosure has four zones: warm & cold ambient (air sensors) and the basking bulb & RHP
 * (thermostat outputs, which also report power %).
 */
export const SensorRole = z.enum(["warm", "cold", "bask", "rhp"]);
export type SensorRole = z.infer<typeof SensorRole>;
export const SENSOR_ROLES: SensorRole[] = ["warm", "cold", "bask", "rhp"];
export const ROLE_LABEL: Record<SensorRole, string> = {
  warm: "Warm Ambient", cold: "Cold Ambient", bask: "Basking", rhp: "RHP",
};

export const AssignSensorInput = z.object({
  deviceId: z.string().uuid(),
  channel: z.string().min(1).max(40),
  snakeIds: z.array(z.string().uuid()).max(500),
  /** Which zone of those snakes' enclosures this channel measures. */
  role: SensorRole.nullable().optional(),
});

export type Metric = "temp_f" | "humidity" | "power_pct" | "setpoint_f";

export interface Reading {
  deviceId: string;
  channel: string;
  metric: Metric;
  value: number;
  at: string;
}

/** Latest values for one enclosure zone. */
export interface Zone {
  role: SensorRole;
  tempF: number | null;
  humidity: number | null;
  powerPct: number | null;
  setpointF: number | null;
  at: string | null;
  stale: boolean;
  /** Reading is outside the snake's range (ambient) or far from setpoint (heat). */
  bad: boolean;
}

export interface SnakeStatus {
  id: string;
  name: string;
  species: string | null;
  morph: string | null;
  photo: string | null;
  zones: Partial<Record<SensorRole, Zone>>;
  readings: (Reading & { deviceName: string; channelLabel: string | null; role: SensorRole | null; stale: boolean })[];
  alerts: string[];
  /** When each kind of husbandry event was last logged (ISO), for the activity view. */
  lastLog: Partial<Record<LogEventType, string>>;
}
