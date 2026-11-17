import { z } from "zod";

export const Sex = z.enum(["male", "female", "unknown"]);
export type Sex = z.infer<typeof Sex>;

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

/** Moves a snake to another collection (home) the user belongs to. */
export const MoveSnakeInput = z.object({ homeId: z.string().uuid() });
export type MoveSnakeInput = z.infer<typeof MoveSnakeInput>;

export interface AlertRanges {
  minTempF: number | null;
  maxTempF: number | null;
  minHumidity: number | null;
  maxHumidity: number | null;
}

export interface Snake extends AlertRanges {
  id: string;
  name: string;
  species: string | null;
  morph: string | null;
  sex: Sex;
  hatchDate: string | null;
  notes: string | null;
  photo: string | null;
}

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

export interface SnakeLog {
  id: string;
  type: LogEventType;
  at: string;
  value: number | null;
  notes: string | null;
}
