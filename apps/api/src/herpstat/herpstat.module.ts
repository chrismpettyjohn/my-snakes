import {Module} from '@nestjs/common';
import {HerpstatService} from './herpstat.service';
import {HerpstatController} from './herpstat.controller';

@Module({controllers: [HerpstatController], providers: [HerpstatService]})
export class HerpstatModule {}
