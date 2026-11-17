import {UserId} from '../auth/auth.guard';
import {ZodPipe} from '../common/zod.pipe';
import {DeviceService} from './device.service';
import {AccessService} from '../common/access.service';
import {ReadingService} from '../reading/reading.service';
import {AssignSensorInput, UpdateDeviceInput} from '@snake/shared';
import {Body, Controller, Delete, ForbiddenException, Get, Param, Put, Query} from '@nestjs/common';

@Controller()
export class DeviceController {
  constructor(
    private access: AccessService,
    private device: DeviceService,
    private reading: ReadingService,
  ) {}

  @Get('homes/:homeId/devices')
  async list(@UserId() u: string, @Param('homeId') homeId: string) {
    await this.access.role(u, homeId);
    return this.device.list(await this.access.homeOwner(homeId), u);
  }

  @Put('devices/:id')
  async update(@UserId() u: string, @Param('id') id: string, @Body(new ZodPipe(UpdateDeviceInput)) body: UpdateDeviceInput) {
    const d = await this.access.device(u, id);
    if (body.host !== undefined && d.ownerId !== u) throw new ForbiddenException('Owner only');
    await this.device.update(d, body);
    return {ok: true};
  }

  @Delete('devices/:id')
  async remove(@UserId() u: string, @Param('id') id: string) {
    await this.access.ownedDevice(u, id);
    await this.device.remove(id);
    return {ok: true};
  }

  @Put('sensor-assignments')
  async assign(@UserId() u: string, @Body(new ZodPipe(AssignSensorInput)) body: AssignSensorInput) {
    await this.device.assign(await this.access.device(u, body.deviceId), body, u);
    return {ok: true};
  }

  @Get('devices/:id/readings')
  async history(@UserId() u: string, @Param('id') id: string, @Query('hours') hours = '24') {
    await this.access.device(u, id);
    return this.reading.history(id, Number(hours));
  }
}
