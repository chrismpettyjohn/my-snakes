import {bearerToken} from '../auth/bearer';
import {ZodPipe} from '../common/zod.pipe';
import {agentSource} from '@snake/lan-bridge';
import {BridgeSyncInput} from '@snake/shared';
import type {Request, Response} from 'express';
import {BridgeService} from './bridge.service';
import {Public, UserId} from '../auth/auth.guard';
import {Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, Res, UnauthorizedException} from '@nestjs/common';

@Controller()
export class BridgeController {
  constructor(private bridge: BridgeService) {}

  @Get('bridges')
  list(@UserId() u: string) {
    return this.bridge.list(u);
  }

  @Post('bridges')
  create(@UserId() u: string) {
    return this.bridge.create(u);
  }

  @Delete('bridges/:id')
  async remove(@UserId() u: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.bridge.remove(u, id);
    return {ok: true};
  }

  @Post('bridge/sync')
  @Public()
  @HttpCode(200)
  sync(@Req() req: Request, @Body(new ZodPipe(BridgeSyncInput)) body: BridgeSyncInput) {
    const token = bearerToken(req.headers.authorization);
    if (!token) throw new UnauthorizedException('Missing bridge token');
    return this.bridge.sync(token, body);
  }

  @Get('bridge/agent.ts')
  @Public()
  async agent(@Res() res: Response) {
    res
      .type('text/plain')
      .set('cache-control', 'no-store')
      .send(await agentSource());
  }
}
