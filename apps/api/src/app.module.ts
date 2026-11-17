import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { CommonModule } from "./common/common.module";
import { DbModule } from "./db/db.module";
import { DeviceModule } from "./device/device.module";
import { GoveeModule } from "./govee/govee.module";
import { HerpstatModule } from "./herpstat/herpstat.module";
import { HomeModule } from "./home/home.module";
import { HusbandryModule } from "./husbandry/husbandry.module";
import { ReadingModule } from "./reading/reading.module";

@Module({
  imports: [DbModule, CommonModule, ReadingModule, AuthModule, HomeModule, HusbandryModule, DeviceModule, GoveeModule, HerpstatModule],
})
export class AppModule {}
