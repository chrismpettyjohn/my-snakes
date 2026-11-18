import {Module} from '@nestjs/common';
import {HerpstatService} from './herpstat.service';
import {WebhookModule} from '../webhook/webhook.module';
import {HerpstatController} from './herpstat.controller';

@Module({imports: [WebhookModule], controllers: [HerpstatController], providers: [HerpstatService]})
export class HerpstatModule {}
