import {API_URL} from '../config';
import {and, eq, sql} from 'drizzle-orm';
import {timingSafeEqual} from 'node:crypto';
import {randomToken} from '../common/crypto';
import {DB, type Db, type Tx} from '../db/db.module';
import type {WebhookProviderName} from '@snake/shared';
import {DiscoveryService, Reflector} from '@nestjs/core';
import {devices, rawUploads, webhooks} from '../db/schema';
import {WEBHOOK_PROVIDER, type WebhookProvider} from './provider';
import {BadRequestException, Inject, Injectable, UnauthorizedException, type OnModuleInit} from '@nestjs/common';

const MAX_RAW_PER_DEVICE = 200;
const MAX_RAW_BODY = 64_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DeviceRow = typeof devices.$inferSelect;
type WebhookRow = typeof webhooks.$inferSelect;

export interface Delivery {
  webhookId: string;
  apiKey: string;
  body: string;
  contentType?: string;
  headers: Record<string, unknown>;
}

export const toWebhook = (w: WebhookRow) => ({url: `${API_URL.replace(/\/$/, '')}/webhook/${w.id}`, apiKey: w.apiKey});

const sameKey = (a: string, b: string) => {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

@Injectable()
export class WebhookService implements OnModuleInit {
  private providers = new Map<WebhookProviderName, WebhookProvider>();

  constructor(
    @Inject(DB) private db: Db,
    private discovery: DiscoveryService,
    private reflector: Reflector,
  ) {}

  onModuleInit() {
    for (const w of this.discovery.getProviders()) {
      if (!w.metatype || !w.instance) continue;
      const name = this.reflector.get<WebhookProviderName | undefined>(WEBHOOK_PROVIDER, w.metatype);
      if (!name) continue;
      if (this.providers.has(name)) throw new Error(`Duplicate @Webhook('${name}') provider`);
      this.providers.set(name, w.instance as WebhookProvider);
    }
  }

  private providerFor(d: DeviceRow): WebhookProviderName {
    for (const [name, p] of this.providers) if (p.deviceKind === d.kind) return name;
    throw new BadRequestException(`${d.kind} devices don't support webhooks`);
  }

  async create(d: DeviceRow, tx: Db | Tx = this.db) {
    const provider = this.providerFor(d);
    const [w] = await tx.insert(webhooks).values({userId: d.ownerId, deviceId: d.id, provider, apiKey: randomToken()}).returning();
    return toWebhook(w!);
  }

  async receive(u: Delivery) {
    if (!UUID.test(u.webhookId)) throw new UnauthorizedException('Unknown webhook');
    const [row] = await this.db
      .select({webhook: webhooks, device: devices})
      .from(webhooks)
      .innerJoin(devices, and(eq(devices.id, webhooks.deviceId), eq(devices.ownerId, webhooks.userId)))
      .where(eq(webhooks.id, u.webhookId));
    if (!row || !sameKey(u.apiKey, row.webhook.apiKey)) throw new UnauthorizedException('Unknown webhook');
    const {device, webhook} = row;
    const provider = this.providers.get(webhook.provider);
    if (!provider || provider.deviceKind !== device.kind) throw new UnauthorizedException('Unknown webhook');

    const receivedAt = new Date();
    const result = await this.db.transaction(async tx => {
      await tx.insert(rawUploads).values({
        deviceId: device.id,
        contentType: u.contentType ?? null,
        headers: u.headers,
        body: u.body.slice(0, MAX_RAW_BODY),
      });
      const r = await provider.receive({webhook, device, body: u.body, contentType: u.contentType, receivedAt, tx});
      await tx.update(webhooks).set({lastReceivedAt: receivedAt}).where(eq(webhooks.id, webhook.id));
      await tx.update(devices).set({lastSeenAt: receivedAt}).where(eq(devices.id, device.id));
      return r;
    });
    await this.pruneRaw(device.id);
    return {ok: true, ...result};
  }

  private async pruneRaw(deviceId: string) {
    await this.db.execute(sql`
      delete from raw_uploads where device_id = ${deviceId} and id not in (
        select id from raw_uploads where device_id = ${deviceId} order by received_at desc limit ${MAX_RAW_PER_DEVICE})`);
  }
}
