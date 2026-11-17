import {Module} from '@nestjs/common';
import {LogService} from './log.service';
import {SnakeService} from './snake.service';
import {HusbandryController} from './husbandry.controller';

@Module({controllers: [HusbandryController], providers: [SnakeService, LogService]})
export class HusbandryModule {}
