import {UserId} from '../auth/auth.guard';
import {ZodPipe} from '../common/zod.pipe';
import {HomeService} from './home.service';
import {StatusService} from './status.service';
import {AccessService} from '../common/access.service';
import {Body, Controller, Get, Param, Post, Put} from '@nestjs/common';
import {CreateHomeInput, InviteMemberInput, UpdateHomeInput} from '@snake/shared';

@Controller('homes')
export class HomeController {
  constructor(
    private home: HomeService,
    private access: AccessService,
    private status: StatusService,
  ) {}

  @Get()
  list(@UserId() userId: string) {
    return this.home.forUser(userId);
  }

  @Post()
  create(@UserId() userId: string, @Body(new ZodPipe(CreateHomeInput)) body: CreateHomeInput) {
    return this.home.create(userId, body.name);
  }

  @Put(':homeId')
  async update(@UserId() userId: string, @Param('homeId') homeId: string, @Body(new ZodPipe(UpdateHomeInput)) body: UpdateHomeInput) {
    await this.access.requireOwner(userId, homeId);
    await this.home.update(homeId, body);
    return {ok: true};
  }

  @Get(':homeId/members')
  async members(@UserId() userId: string, @Param('homeId') homeId: string) {
    await this.access.role(userId, homeId);
    return this.home.members(homeId);
  }

  @Post(':homeId/members')
  async invite(@UserId() userId: string, @Param('homeId') homeId: string, @Body(new ZodPipe(InviteMemberInput)) body: InviteMemberInput) {
    await this.access.requireOwner(userId, homeId);
    await this.home.addMember(homeId, body.username);
    return {ok: true};
  }

  @Get(':homeId/status')
  async homeStatus(@UserId() userId: string, @Param('homeId') homeId: string) {
    await this.access.role(userId, homeId);
    return this.status.forHome(homeId);
  }
}
