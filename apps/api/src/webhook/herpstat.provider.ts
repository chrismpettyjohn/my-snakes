import {eq} from 'drizzle-orm';
import {devices} from '../db/schema';
import {ReadingService} from '../reading/reading.service';
import {parseHerpstatUpload} from '../herpstat/herpstat-parser';
import {Webhook, type WebhookDelivery, type WebhookProvider} from './provider';

@Webhook('herpstat')
export class HerpstatWebhookProvider implements WebhookProvider {
  readonly deviceKind = 'herpstat';

  constructor(private reading: ReadingService) {}

  async receive({device, body, contentType, receivedAt, tx}: WebhookDelivery) {
    const parsed = parseHerpstatUpload(body, contentType);
    await this.reading.record(device.id, parsed.readings, receivedAt, tx);
    await tx
      .update(devices)
      .set({
        externalId: device.externalId ?? parsed.mac ?? null,
        model: device.model ?? parsed.model ?? null,
        firmware: parsed.firmware ?? device.firmware,
        channelLabels: parsed.channelLabels ?? device.channelLabels,
      })
      .where(eq(devices.id, device.id));
    return {readings: parsed.readings.length};
  }
}
