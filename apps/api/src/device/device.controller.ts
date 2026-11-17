import { Body, Controller, Delete, Get, Param, Put, Query } from "@nestjs/common";
import { AssignSensorInput, UpdateDeviceInput } from "@snake/shared";
import { UserId } from "../auth/auth.guard";
import { AccessService } from "../common/access.service";
import { ZodPipe } from "../common/zod.pipe";
import { ReadingService } from "../reading/reading.service";
import { DeviceService } from "./device.service";

@Controller()
export class DeviceController {
  constructor(private access: AccessService, private device: DeviceService, private reading: ReadingService) {}

  @Get("homes/:homeId/devices")
  async list(@UserId() u: string, @Param("homeId") homeId: string) {
    return this.device.list(homeId, await this.access.role(u, homeId));
  }

  @Put("devices/:id")
  async update(@UserId() u: string, @Param("id") id: string, @Body(new ZodPipe(UpdateDeviceInput)) body: UpdateDeviceInput) {
    const d = await this.access.device(u, id);
    if (body.host !== undefined) await this.access.requireOwner(u, d.homeId);
    await this.device.update(d, body);
    return { ok: true };
  }

  @Delete("devices/:id")
  async remove(@UserId() u: string, @Param("id") id: string) {
    await this.access.ownedDevice(u, id);
    await this.device.remove(id);
    return { ok: true };
  }

  @Put("sensor-assignments")
  async assign(@UserId() u: string, @Body(new ZodPipe(AssignSensorInput)) body: AssignSensorInput) {
    await this.device.assign(await this.access.device(u, body.deviceId), body);
    return { ok: true };
  }

  @Get("devices/:id/readings")
  async history(@UserId() u: string, @Param("id") id: string, @Query("hours") hours = "24") {
    await this.access.device(u, id);
    return this.reading.history(id, Number(hours));
  }
}
