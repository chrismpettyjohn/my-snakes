import { Module } from "@nestjs/common";
import { HusbandryController } from "./husbandry.controller";
import { LogService } from "./log.service";
import { SnakeService } from "./snake.service";

@Module({ controllers: [HusbandryController], providers: [SnakeService, LogService] })
export class HusbandryModule {}
