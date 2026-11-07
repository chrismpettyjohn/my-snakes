import { Module } from "@nestjs/common";
import { HomesController } from "./homes.controller";
import { StatusService } from "./status.service";

@Module({ controllers: [HomesController], providers: [StatusService] })
export class HomesModule {}
