import { Module } from "@nestjs/common";
import { HomeController } from "./home.controller";
import { HomeService } from "./home.service";
import { StatusService } from "./status.service";

@Module({ controllers: [HomeController], providers: [HomeService, StatusService], exports: [HomeService] })
export class HomeModule {}
