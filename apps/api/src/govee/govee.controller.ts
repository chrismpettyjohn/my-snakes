import { BadRequestException, Body, Controller, Delete, Post, Put } from "@nestjs/common";
import { SetGoveeKeyInput } from "@snake/shared";
import { UserId } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { GoveeService } from "./govee.service";

/** The signed-in user's own Govee account; its sensors serve snakes in all their collections. */
@Controller("govee")
export class GoveeController {
  constructor(private govee: GoveeService) {}

  @Put()
  async setKey(@UserId() u: string, @Body(new ZodPipe(SetGoveeKeyInput)) body: SetGoveeKeyInput) {
    try {
      return await this.govee.setKey(u, body.apiKey, body.email);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : "Govee rejected the key");
    }
  }

  @Delete()
  async clearKey(@UserId() u: string) {
    await this.govee.clearKey(u);
    return { ok: true };
  }

  @Post("refresh")
  async refresh(@UserId() u: string) {
    await this.govee.pollUser(u, { fresh: true });
    return { ok: true };
  }
}
