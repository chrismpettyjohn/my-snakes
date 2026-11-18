import {Module} from '@nestjs/common';
import {BridgeService} from './bridge.service';
import {BridgeController} from './bridge.controller';
import {WebhookModule} from '../webhook/webhook.module';

@Module({imports: [WebhookModule], controllers: [BridgeController], providers: [BridgeService]})
export class BridgeModule {}
