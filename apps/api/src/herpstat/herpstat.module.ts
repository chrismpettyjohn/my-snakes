import { Module } from "@nestjs/common";
import { HerpstatPollerService } from "./herpstat-poller.service";
import { IngestController } from "./ingest/ingest.controller";

@Module({ controllers: [IngestController], providers: [HerpstatPollerService], exports: [HerpstatPollerService] })
export class HerpstatModule {}
