import { Module } from "@nestjs/common";
import { HerpstatController } from "./herpstat.controller";
import { HerpstatPollerService } from "./herpstat-poller.service";
import { HerpstatService } from "./herpstat.service";
import { IngestController } from "./ingest/ingest.controller";
import { IngestService } from "./ingest/ingest.service";

@Module({
  controllers: [HerpstatController, IngestController],
  providers: [HerpstatService, HerpstatPollerService, IngestService],
  exports: [HerpstatPollerService],
})
export class HerpstatModule {}
