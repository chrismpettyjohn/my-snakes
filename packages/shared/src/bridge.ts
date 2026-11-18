import {z} from 'zod';

const Mac = z
  .string()
  .regex(/^([0-9a-f]{2}[:-]?){5}[0-9a-f]{2}$/i)
  .transform(s => s.toUpperCase());

export const BridgeSyncInput = z.object({
  hostname: z.string().max(120).optional(),
  version: z.number().int().optional(),
  herpstats: z
    .array(
      z.object({
        mac: Mac,
        host: z.string().max(255).optional(),
        nickname: z.string().max(80).optional(),
        outputs: z.number().int().min(1).max(16).optional(),
      }),
    )
    .max(64),
});
export type BridgeSyncInput = z.infer<typeof BridgeSyncInput>;

export interface BridgeSyncResult {
  herpstats: {mac: string; deviceId: string; name: string; webhook: {url: string; apiKey: string}}[];
}

export interface Bridge {
  id: string;
  hostname: string | null;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface CreatedBridge {
  bridge: Bridge;
  install: {unix: string; windows: string};
}
