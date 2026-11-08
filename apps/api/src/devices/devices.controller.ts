import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Post, Put, Query } from "@nestjs/common";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { AssignSensorInput, CreateHerpstatInput, SetGoveeKeyInput, UpdateDeviceInput } from "@snake/shared";
import { discoverHerpstats } from "../herpstat/discover";
import { HerpstatPollerService } from "../herpstat/herpstat-poller.service";
import { UserId } from "../auth/auth.guard";
import { AccessService } from "../common/access.service";
import { randomToken } from "../common/crypto";
import { ZodPipe } from "../common/zod.pipe";
import { PUBLIC_API_URL } from "../config";
import { DB, type Db } from "../db/db.module";
import { snakeSensors, snakes, devices, homes, rawUploads, readings, readings5m } from "../db/schema";
import { GoveeService } from "../govee/govee.service";

const uploadUrl = (token: string) => `${PUBLIC_API_URL}/ingest/herpstat/${token}`;

@Controller()
export class DevicesController {
  constructor(@Inject(DB) private db: Db, private access: AccessService, private goveeSvc: GoveeService,
    private poller: HerpstatPollerService) {}

  @Get("homes/:homeId/devices")
  async list(@UserId() u: string, @Param("homeId") homeId: string) {
    const role = await this.access.role(u, homeId);
    const devs = await this.db.select().from(devices).where(eq(devices.homeId, homeId)).orderBy(devices.kind, devices.name);
    const ids = devs.map((d) => d.id);
    const [channels, assigns, [home]] = await Promise.all([
      ids.length
        ? this.db.selectDistinct({ deviceId: readings.deviceId, channel: readings.channel }).from(readings)
          .where(and(inArray(readings.deviceId, ids), gt(readings.at, sql`now() - interval '7 days'`)))
        : [],
      ids.length ? this.db.select().from(snakeSensors).where(inArray(snakeSensors.deviceId, ids)) : [],
      this.db.select().from(homes).where(eq(homes.id, homeId)),
    ]);
    return {
      govee: { configured: !!home!.goveeApiKeyEnc, email: home!.goveeAccountEmail, lastSyncAt: home!.goveeLastSyncAt, lastError: home!.goveeLastError },
      devices: devs.map((d) => ({
        id: d.id, kind: d.kind, name: d.name, model: d.model, externalId: d.externalId, lastSeenAt: d.lastSeenAt,
        host: d.host, firmware: d.firmware, lastError: d.lastError,
        // Only owners see the Herpstat upload secret.
        uploadUrl: d.kind === "herpstat" && role === "owner" && d.ingestToken ? uploadUrl(d.ingestToken) : undefined,
        apiKey: d.kind === "herpstat" && role === "owner" ? d.ingestToken : undefined,
        channels: [...new Set([
          // A Govee sensor is a single channel; show it before its first reading arrives.
          ...(d.kind === "govee" ? ["main"] : []),
          ...channels.filter((c) => c.deviceId === d.id).map((c) => c.channel),
          ...assigns.filter((a) => a.deviceId === d.id).map((a) => a.channel),
        ])].sort().map((channel) => ({
          channel, label: d.channelLabels?.[channel] ?? null,
          snakeIds: assigns.filter((a) => a.deviceId === d.id && a.channel === channel).map((a) => a.snakeId),
          role: assigns.find((a) => a.deviceId === d.id && a.channel === channel)?.role ?? null,
        })),
      })),
    };
  }

  @Post("homes/:homeId/devices/herpstat")
  async addHerpstat(@UserId() u: string, @Param("homeId") homeId: string,
    @Body(new ZodPipe(CreateHerpstatInput)) body: { name: string; host?: string }) {
    await this.access.requireOwner(u, homeId);
    const token = randomToken();
    const [d] = await this.db.insert(devices)
      .values({ homeId, kind: "herpstat", name: body.name, host: body.host ?? null, ingestToken: token }).returning();
    if (d!.host) await this.poller.pollDevice(d!.id);
    return { id: d!.id, uploadUrl: uploadUrl(token), apiKey: token };
  }

  /** Pull fresh /RAWSTATUS from one LAN Herpstat right now. */
  @Post("devices/:id/refresh")
  async refreshHerpstat(@UserId() u: string, @Param("id") id: string) {
    const d = await this.access.device(u, id);
    if (d.kind !== "herpstat" || !d.host) throw new BadRequestException("Only Herpstats with an IP address can be refreshed");
    await this.poller.pollDevice(id);
    return { ok: true };
  }

  /** Scans the API host's LAN for SpyderWeb units not yet added to this home. */
  @Post("homes/:homeId/devices/herpstat/discover")
  async discover(@UserId() u: string, @Param("homeId") homeId: string) {
    await this.access.requireOwner(u, homeId);
    const existing = await this.db.select({ host: devices.host, ext: devices.externalId }).from(devices)
      .where(and(eq(devices.homeId, homeId), eq(devices.kind, "herpstat")));
    return (await discoverHerpstats())
      .filter((f) => !existing.some((e) => e.host === f.host || e.ext === f.mac));
  }

  @Post("devices/:id/rotate-key")
  async rotate(@UserId() u: string, @Param("id") id: string) {
    const d = await this.access.device(u, id);
    await this.access.requireOwner(u, d.homeId);
    if (d.kind !== "herpstat") throw new BadRequestException("Only Herpstat devices have upload keys");
    const token = randomToken();
    await this.db.update(devices).set({ ingestToken: token }).where(eq(devices.id, id));
    return { uploadUrl: uploadUrl(token), apiKey: token };
  }

  @Put("devices/:id")
  async update(@UserId() u: string, @Param("id") id: string,
    @Body(new ZodPipe(UpdateDeviceInput)) body: { name?: string; host?: string | null }) {
    const d = await this.access.device(u, id);
    if (body.host !== undefined) await this.access.requireOwner(u, d.homeId);
    await this.db.update(devices).set({ ...body, lastError: body.host !== undefined ? null : d.lastError })
      .where(eq(devices.id, id));
    if (d.kind === "herpstat" && body.host) await this.poller.pollDevice(id);
    return { ok: true };
  }

  @Delete("devices/:id")
  async remove(@UserId() u: string, @Param("id") id: string) {
    const d = await this.access.device(u, id);
    await this.access.requireOwner(u, d.homeId);
    await this.db.delete(devices).where(eq(devices.id, id));
    return { ok: true };
  }

  /** Replaces the set of snakes one device channel serves. */
  @Put("sensor-assignments")
  async assign(@UserId() u: string,
    @Body(new ZodPipe(AssignSensorInput)) body: { deviceId: string; channel: string; snakeIds: string[]; role?: "warm" | "cold" | "bask" | "rhp" | null }) {
    const d = await this.access.device(u, body.deviceId);
    const ids = [...new Set(body.snakeIds)];
    if (ids.length) {
      const owned = await this.db.select({ id: snakes.id }).from(snakes)
        .where(and(eq(snakes.homeId, d.homeId), inArray(snakes.id, ids)));
      if (owned.length !== ids.length) throw new BadRequestException("Snakes must belong to the device's collection");
    }
    await this.db.transaction(async (tx) => {
      await tx.delete(snakeSensors)
        .where(and(eq(snakeSensors.deviceId, d.id), eq(snakeSensors.channel, body.channel)));
      if (ids.length) {
        await tx.insert(snakeSensors).values(ids.map((snakeId) => ({ snakeId, deviceId: d.id, channel: body.channel, role: body.role ?? null })));
      }
    });
    return { ok: true };
  }

  @Get("devices/:id/readings")
  async history(@UserId() u: string, @Param("id") id: string, @Query("hours") hours = "24") {
    await this.access.device(u, id);
    const h = Math.min(Math.max(Number(hours) || 24, 1), 24 * 365);
    // Raw 30 s points for short windows; 5-minute averages (kept forever) beyond 48h.
    if (h <= 48) {
      return this.db.select({ channel: readings.channel, metric: readings.metric, value: readings.value, at: readings.at })
        .from(readings)
        .where(and(eq(readings.deviceId, id), gt(readings.at, sql`now() - make_interval(hours => ${h})`)))
        .orderBy(readings.at);
    }
    return this.db.select({
      channel: readings5m.channel, metric: readings5m.metric, value: readings5m.avg, at: readings5m.bucket,
      min: readings5m.min, max: readings5m.max,
    })
      .from(readings5m)
      .where(and(eq(readings5m.deviceId, id), gt(readings5m.bucket, sql`now() - make_interval(hours => ${h})`)))
      .orderBy(readings5m.bucket);
  }

  /** Recent raw Herpstat uploads, for checking what the firmware actually sends. */
  @Get("devices/:id/raw-uploads")
  async raw(@UserId() u: string, @Param("id") id: string) {
    const d = await this.access.device(u, id);
    await this.access.requireOwner(u, d.homeId);
    return this.db.select().from(rawUploads).where(eq(rawUploads.deviceId, id)).orderBy(desc(rawUploads.receivedAt)).limit(20);
  }

  // ----- Govee -----
  @Put("homes/:homeId/govee")
  async setGovee(@UserId() u: string, @Param("homeId") homeId: string,
    @Body(new ZodPipe(SetGoveeKeyInput)) body: { apiKey: string; email: string }) {
    await this.access.requireOwner(u, homeId);
    try {
      return await this.goveeSvc.setKey(homeId, body.apiKey, body.email);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : "Govee rejected the key");
    }
  }

  @Delete("homes/:homeId/govee")
  async clearGovee(@UserId() u: string, @Param("homeId") homeId: string) {
    await this.access.requireOwner(u, homeId);
    await this.goveeSvc.clearKey(homeId);
    return { ok: true };
  }

  @Post("homes/:homeId/govee/refresh")
  async refreshGovee(@UserId() u: string, @Param("homeId") homeId: string) {
    await this.access.role(u, homeId);
    await this.goveeSvc.pollHome(homeId, { fresh: true });
    return { ok: true };
  }
}
