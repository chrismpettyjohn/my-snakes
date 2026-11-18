import {createHash} from 'node:crypto';
import {and, eq, isNull} from 'drizzle-orm';
import {DB, type Db} from '../db/db.module';
import {randomToken} from '../common/crypto';
import {API_URL, BRIDGE_PATH} from '../config';
import {bridges, devices, webhooks} from '../db/schema';
import {toWebhook, WebhookService} from '../webhook/webhook.service';
import {Inject, Injectable, NotFoundException, UnauthorizedException} from '@nestjs/common';
import type {Bridge, BridgeSyncInput, BridgeSyncResult, CreatedBridge} from '@snake/shared';

type BridgeRow = typeof bridges.$inferSelect;
type Herpstat = BridgeSyncInput['herpstats'][number];

const INSTALL_URL = 'https://raw.githubusercontent.com/chrismpettyjohn/my-snakes/main/packages/lan-bridge/install';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const apiBase = () => API_URL.replace(/\/$/, '');

const installCommands = (args: string) =>
  BRIDGE_PATH
    ? {unix: `sh '${BRIDGE_PATH}/install/install.sh' ${args}`, windows: `& '${BRIDGE_PATH}/install/install.ps1' ${args}`}
    : {
        unix: `curl -fsSL ${INSTALL_URL}/install.sh | sh -s -- ${args}`,
        windows: `& ([scriptblock]::Create((irm ${INSTALL_URL}/install.ps1))) ${args}`,
      };

const toBridge = (b: BridgeRow): Bridge => ({
  id: b.id,
  hostname: b.hostname,
  createdAt: b.createdAt.toISOString(),
  lastSeenAt: b.lastSeenAt?.toISOString() ?? null,
});

@Injectable()
export class BridgeService {
  constructor(
    @Inject(DB) private db: Db,
    private webhook: WebhookService,
  ) {}

  async list(userId: string): Promise<Bridge[]> {
    const rows = await this.db.select().from(bridges).where(eq(bridges.userId, userId)).orderBy(bridges.createdAt);
    return rows.map(toBridge);
  }

  async create(userId: string): Promise<CreatedBridge> {
    const token = randomToken(32);
    const [b] = await this.db
      .insert(bridges)
      .values({userId, tokenHash: hashToken(token)})
      .returning();
    return {
      bridge: toBridge(b!),
      install: installCommands(`'${apiBase()}' '${token}'`),
    };
  }

  async remove(userId: string, id: string) {
    const gone = await this.db
      .delete(bridges)
      .where(and(eq(bridges.id, id), eq(bridges.userId, userId)))
      .returning({id: bridges.id});
    if (!gone.length) throw new NotFoundException('Bridge not found');
  }

  async sync(token: string, input: BridgeSyncInput): Promise<BridgeSyncResult> {
    const [b] = await this.db
      .update(bridges)
      .set({lastSeenAt: new Date(), hostname: input.hostname ?? null})
      .where(eq(bridges.tokenHash, hashToken(token)))
      .returning();
    if (!b) throw new UnauthorizedException('Unknown bridge');
    const out: BridgeSyncResult['herpstats'] = [];
    for (const h of input.herpstats) {
      const d = await this.deviceFor(b.userId, h);
      const [w] = await this.db.select().from(webhooks).where(eq(webhooks.deviceId, d.id)).orderBy(webhooks.createdAt).limit(1);
      out.push({mac: h.mac, deviceId: d.id, name: d.name, webhook: w ? toWebhook(w) : await this.webhook.create(d)});
    }
    return {herpstats: out};
  }

  private async deviceFor(ownerId: string, h: Herpstat) {
    const mine = and(eq(devices.ownerId, ownerId), eq(devices.kind, 'herpstat'));
    const [known] = await this.db
      .select()
      .from(devices)
      .where(and(mine, eq(devices.externalId, h.mac)));
    if (known) return known;

    const nickname = h.nickname?.trim();
    if (nickname) {
      const [named] = await this.db
        .select({id: devices.id})
        .from(devices)
        .where(and(mine, isNull(devices.externalId), eq(devices.name, nickname)))
        .orderBy(devices.createdAt)
        .limit(1);
      if (named) {
        const [d] = await this.db.update(devices).set({externalId: h.mac}).where(eq(devices.id, named.id)).returning();
        return d!;
      }
    }

    await this.db
      .insert(devices)
      .values({
        ownerId,
        kind: 'herpstat',
        name: nickname || `Herpstat ${h.mac.slice(-5)}`,
        externalId: h.mac,
        model: h.outputs ? `Herpstat ${h.outputs}` : null,
      })
      .onConflictDoNothing();
    const [d] = await this.db
      .select()
      .from(devices)
      .where(and(mine, eq(devices.externalId, h.mac)));
    return d!;
  }
}
