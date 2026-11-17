import { BadRequestException, Body, Controller, Delete, Param, Post, Put } from "@nestjs/common";
import { SetGoveeKeyInput } from "@snake/shared";
import { UserId } from "../auth/auth.guard";
import { AccessService } from "../common/access.service";
import { ZodPipe } from "../common/zod.pipe";
import { GoveeService } from "./govee.service";

@Controller("homes/:homeId/govee")
export class GoveeController {
  constructor(private access: AccessService, private govee: GoveeService) {}

  @Put()
  async setKey(@UserId() u: string, @Param("homeId") homeId: string,
    @Body(new ZodPipe(SetGoveeKeyInput)) body: SetGoveeKeyInput) {
    await this.access.requireOwner(u, homeId);
    try {
      return await this.govee.setKey(homeId, body.apiKey, body.email);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : "Govee rejected the key");
    }
  }

  @Delete()
  async clearKey(@UserId() u: string, @Param("homeId") homeId: string) {
    await this.access.requireOwner(u, homeId);
    await this.govee.clearKey(homeId);
    return { ok: true };
  }

  @Post("refresh")
  async refresh(@UserId() u: string, @Param("homeId") homeId: string) {
    await this.access.role(u, homeId);
    await this.govee.pollHome(homeId, { fresh: true });
    return { ok: true };
  }
}
