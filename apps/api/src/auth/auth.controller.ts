import {ZodPipe} from '../common/zod.pipe';
import {AuthService} from './auth.service';
import {Public, UserId} from './auth.guard';
import {authorizeUrl} from './discord.client';
import {DiscordLoginInput} from '@snake/shared';
import {BadRequestException, Body, Controller, Get, Post, Query} from '@nestjs/common';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Get('discord/url')
  discordUrl(@Query('state') state?: string) {
    if (!state || !/^[\w-]{16,128}$/.test(state)) throw new BadRequestException('Invalid state');
    return {url: authorizeUrl(state)};
  }

  @Public()
  @Post('discord')
  discord(@Body(new ZodPipe(DiscordLoginInput)) body: DiscordLoginInput) {
    return this.auth.discordLogin(body.code);
  }

  @Get('me')
  me(@UserId() userId: string) {
    return this.auth.me(userId);
  }
}
