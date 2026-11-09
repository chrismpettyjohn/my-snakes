import { Controller, HttpCode, Inject, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { eq, sql } from "drizzle-orm";
import { Public } from "../../auth/auth.guard";
import { DB, type Db } from "../../db/db.module";
import { devices, rawUploads, readings } from "../../db/schema";
import { parseHerpstatUpload } from "./herpstat-parser";

const MAX_RAW_PER_DEVICE = 200;

/**
 * Herpstat SpyderWeb "custom URL" upload target. The device's secret can arrive in the path,
 * a query param, an API-key header, or a body field, since the firmware's exact format is unknown.
 */
@Controller("ingest/herpstat")
@Public()
export class IngestController {
  constructor(@Inject(DB) private db: Db) {}

  @Post() @HttpCode(200)
  receive(@Req() req: Request) { return this.handle(req, undefined); }

  @Post(":token") @HttpCode(200)
  receiveWithToken(@Req() req: Request, @Param("token") token: string) { return this.handle(req, token); }

  private async handle(req: Request, pathToken?: string) {
    const body = typeof req.body === "string" ? req.body : "";
    const token = pathToken ?? this.findToken(req, body);
    if (!token) throw new UnauthorizedException("Missing API key");
    const [device] = await this.db.select().from(devices).where(eq(devices.ingestToken, token));
    if (!device || device.kind !== "herpstat") throw new UnauthorizedException("Unknown API key");

    const parsed = parseHerpstatUpload(body, req.headers["content-type"]);
    const now = new Date();
    await this.db.transaction(async (tx) => {
      await tx.insert(rawUploads).values({
        deviceId: device.id, contentType: req.headers["content-type"] ?? null,
        headers: req.headers, body: body.slice(0, 64_000),
      });
      if (parsed.readings.length) {
        await tx.insert(readings).values(parsed.readings.map((r) => ({ ...r, deviceId: device.id, at: now })));
      }
      await tx.update(devices).set({
        lastSeenAt: now,
        externalId: device.externalId ?? parsed.mac ?? null,
        model: device.model ?? parsed.model ?? null,
      }).where(eq(devices.id, device.id));
    });
    // Keep raw history bounded.
    await this.db.execute(sql`
      delete from raw_uploads where device_id = ${device.id} and id not in (
        select id from raw_uploads where device_id = ${device.id} order by received_at desc limit ${MAX_RAW_PER_DEVICE})`);
    return { ok: true, readings: parsed.readings.length };
  }

  private findToken(req: Request, body: string): string | undefined {
    const h = req.headers;
    const q = req.query as Record<string, string | undefined>;
    const auth = typeof h.authorization === "string" && h.authorization.startsWith("Bearer ") ? h.authorization.slice(7) : undefined;
    const fromHeader = (h["x-api-key"] ?? h["apikey"] ?? h["api-key"]) as string | undefined;
    let fromBody: string | undefined;
    try {
      const b = body.trim().startsWith("{") ? JSON.parse(body) : Object.fromEntries(new URLSearchParams(body));
      fromBody = b.apikey ?? b.api_key ?? b.apiKey ?? b.APIKEY ?? b.key;
    } catch { /* ignore */ }
    return q.key ?? q.apikey ?? q.api_key ?? fromHeader ?? auth ?? fromBody;
  }
}
