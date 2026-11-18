import type {Tx} from '../db/db.module';
import type {devices, webhooks} from '../db/schema';
import type {DeviceKind, WebhookProviderName} from '@snake/shared';
import {applyDecorators, Injectable, SetMetadata} from '@nestjs/common';

export const WEBHOOK_PROVIDER = 'webhook:provider';

export const Webhook = (provider: WebhookProviderName) => applyDecorators(Injectable(), SetMetadata(WEBHOOK_PROVIDER, provider));

export interface WebhookDelivery {
  webhook: typeof webhooks.$inferSelect;
  device: typeof devices.$inferSelect;
  body: string;
  contentType?: string;
  receivedAt: Date;
  tx: Tx;
}

export interface WebhookProvider {
  readonly deviceKind: DeviceKind;
  receive(delivery: WebhookDelivery): Promise<{readings: number}>;
}
