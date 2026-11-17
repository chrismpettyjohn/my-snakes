import {Module} from '@nestjs/common';
import {GoveeService} from './govee.service';
import {GoveeController} from './govee.controller';

@Module({controllers: [GoveeController], providers: [GoveeService], exports: [GoveeService]})
export class GoveeModule {}
