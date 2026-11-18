import {Module} from '@nestjs/common';
import {DbModule} from './db/db.module';
import {AuthModule} from './auth/auth.module';
import {HomeModule} from './home/home.module';
import {GoveeModule} from './govee/govee.module';
import {CommonModule} from './common/common.module';
import {DeviceModule} from './device/device.module';
import {ReadingModule} from './reading/reading.module';
import {WebhookModule} from './webhook/webhook.module';
import {HerpstatModule} from './herpstat/herpstat.module';
import {HusbandryModule} from './husbandry/husbandry.module';

@Module({
  imports: [DbModule, CommonModule, ReadingModule, AuthModule, HomeModule, HusbandryModule, DeviceModule, GoveeModule, WebhookModule, HerpstatModule],
})
export class AppModule {}
