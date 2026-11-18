import {UserId} from '../auth/auth.guard';
import {HerpstatService} from './herpstat.service';
import {Controller, Get, Param} from '@nestjs/common';
import {AccessService} from '../common/access.service';

@Controller()
export class HerpstatController {
  constructor(
    private access: AccessService,
    private herpstat: HerpstatService,
  ) {}

  @Get('devices/:id/raw-uploads')
  async rawUploads(@UserId() u: string, @Param('id') id: string) {
    await this.access.ownedDevice(u, id);
    return this.herpstat.rawUploads(id);
  }
}
