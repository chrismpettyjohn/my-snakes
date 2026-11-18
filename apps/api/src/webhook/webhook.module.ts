import {Module} from '@nestjs/common';
import {DiscoveryModule} from '@nestjs/core';
import {WebhookService} from './webhook.service';
import {WebhookController} from './webhook.controller';
import {HerpstatWebhookProvider} from './herpstat.provider';

@Module({
  imports: [DiscoveryModule],
  controllers: [WebhookController],
  providers: [WebhookService, HerpstatWebhookProvider],
  exports: [WebhookService],
})
export class WebhookModule {}
