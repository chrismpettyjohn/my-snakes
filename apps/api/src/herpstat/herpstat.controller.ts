import {UserId} from '../auth/auth.guard';
import {ZodPipe} from '../common/zod.pipe';
import {CreateHerpstatInput} from '@snake/shared';
import {HerpstatService} from './herpstat.service';
import {AccessService} from '../common/access.service';
import {Body, Controller, Get, Param, Post} from '@nestjs/common';

@Controller()
export class HerpstatController {
  constructor(
    private access: AccessService,
    private herpstat: HerpstatService,
  ) {}

  @Post('devices/herpstat')
  add(@UserId() u: string, @Body(new ZodPipe(CreateHerpstatInput)) body: CreateHerpstatInput) {
    return this.herpstat.add(u, body);
  }

  @Post('devices/herpstat/discover')
  discover(@UserId() u: string) {
    return this.herpstat.discover(u);
  }

  @Post('devices/:id/refresh')
  async refresh(@UserId() u: string, @Param('id') id: string) {
    await this.herpstat.refresh(await this.access.device(u, id));
    return {ok: true};
  }

  @Post('devices/:id/rotate-key')
  async rotateKey(@UserId() u: string, @Param('id') id: string) {
    return this.herpstat.rotateKey(await this.access.ownedDevice(u, id));
  }

  @Get('devices/:id/raw-uploads')
  async rawUploads(@UserId() u: string, @Param('id') id: string) {
    await this.access.ownedDevice(u, id);
    return this.herpstat.rawUploads(id);
  }
}
