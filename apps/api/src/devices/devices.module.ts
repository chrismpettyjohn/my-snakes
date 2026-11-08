import { Module } from "@nestjs/common";
import { GoveeService } from "../govee/govee.service";
import { DevicesController } from "./devices.controller";
import { HerpstatModule } from "../herpstat/herpstat.module";

@Module({ imports: [HerpstatModule], controllers: [DevicesController], providers: [GoveeService] })
export class DevicesModule {}
