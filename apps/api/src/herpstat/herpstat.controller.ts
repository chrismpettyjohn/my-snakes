import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CreateHerpstatInput } from "@snake/shared";
import { UserId } from "../auth/auth.guard";
import { AccessService } from "../common/access.service";
import { ZodPipe } from "../common/zod.pipe";
import { HerpstatService } from "./herpstat.service";

@Controller()
export class HerpstatController {
  constructor(private access: AccessService, private herpstat: HerpstatService) {}

  @Post("homes/:homeId/devices/herpstat")
  async add(@UserId() u: string, @Param("homeId") homeId: string,
    @Body(new ZodPipe(CreateHerpstatInput)) body: CreateHerpstatInput) {
    await this.access.requireOwner(u, homeId);
    return this.herpstat.add(homeId, body);
  }

  @Post("homes/:homeId/devices/herpstat/discover")
  async discover(@UserId() u: string, @Param("homeId") homeId: string) {
    await this.access.requireOwner(u, homeId);
    return this.herpstat.discover(homeId);
  }

  @Post("devices/:id/refresh")
  async refresh(@UserId() u: string, @Param("id") id: string) {
    await this.herpstat.refresh(await this.access.device(u, id));
    return { ok: true };
  }

  @Post("devices/:id/rotate-key")
  async rotateKey(@UserId() u: string, @Param("id") id: string) {
    return this.herpstat.rotateKey(await this.access.ownedDevice(u, id));
  }

  @Get("devices/:id/raw-uploads")
  async rawUploads(@UserId() u: string, @Param("id") id: string) {
    await this.access.ownedDevice(u, id);
    return this.herpstat.rawUploads(id);
  }
}
