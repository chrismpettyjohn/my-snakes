import { Module } from "@nestjs/common";
import { GoveeController } from "./govee.controller";
import { GoveeService } from "./govee.service";

@Module({ controllers: [GoveeController], providers: [GoveeService], exports: [GoveeService] })
export class GoveeModule {}
