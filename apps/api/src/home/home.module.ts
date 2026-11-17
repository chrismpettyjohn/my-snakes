import {Module} from '@nestjs/common';
import {HomeService} from './home.service';
import {StatusService} from './status.service';
import {HomeController} from './home.controller';

@Module({controllers: [HomeController], providers: [HomeService, StatusService], exports: [HomeService]})
export class HomeModule {}
