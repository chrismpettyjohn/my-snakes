import { Module } from "@nestjs/common";
import { GoveeModule } from "../govee/govee.module";
import { HerpstatModule } from "../herpstat/herpstat.module";
import { DeviceController } from "./device.controller";
import { DeviceService } from "./device.service";

@Module({ imports: [HerpstatModule, GoveeModule], controllers: [DeviceController], providers: [DeviceService] })
export class DeviceModule {}
