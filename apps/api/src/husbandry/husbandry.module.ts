import { Module } from "@nestjs/common";
import { HusbandryController } from "./husbandry.controller";

@Module({ controllers: [HusbandryController] })
export class HusbandryModule {}
