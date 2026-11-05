import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { CommonModule } from "./common/common.module";
import { DbModule } from "./db/db.module";
import { DevicesModule } from "./devices/devices.module";
import { HomesModule } from "./homes/homes.module";
import { HusbandryModule } from "./husbandry/husbandry.module";
import { HerpstatModule } from "./herpstat/herpstat.module";

@Module({ imports: [DbModule, CommonModule, AuthModule, HomesModule, HusbandryModule, DevicesModule, HerpstatModule] })
export class AppModule {}
