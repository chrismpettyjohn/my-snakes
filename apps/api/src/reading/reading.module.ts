import { Global, Module } from "@nestjs/common";
import { ReadingService } from "./reading.service";

@Global()
@Module({ providers: [ReadingService], exports: [ReadingService] })
export class ReadingModule {}
