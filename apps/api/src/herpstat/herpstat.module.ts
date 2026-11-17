import {Module} from '@nestjs/common';
import {HerpstatService} from './herpstat.service';
import {IngestService} from './ingest/ingest.service';
import {HerpstatController} from './herpstat.controller';
import {IngestController} from './ingest/ingest.controller';
import {HerpstatPollerService} from './herpstat-poller.service';

@Module({
  controllers: [HerpstatController, IngestController],
  providers: [HerpstatService, HerpstatPollerService, IngestService],
  exports: [HerpstatPollerService],
})
export class HerpstatModule {}
