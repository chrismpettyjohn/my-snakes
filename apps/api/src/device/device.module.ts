import {Module} from '@nestjs/common';
import {DeviceService} from './device.service';
import {GoveeModule} from '../govee/govee.module';
import {DeviceController} from './device.controller';
import {HerpstatModule} from '../herpstat/herpstat.module';

@Module({imports: [HerpstatModule, GoveeModule], controllers: [DeviceController], providers: [DeviceService]})
export class DeviceModule {}
