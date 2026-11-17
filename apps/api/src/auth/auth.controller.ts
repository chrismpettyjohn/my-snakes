import {ZodPipe} from '../common/zod.pipe';
import {AuthService} from './auth.service';
import {Public, UserId} from './auth.guard';
import {LoginInput, RegisterInput} from '@snake/shared';
import {Body, Controller, Get, Post} from '@nestjs/common';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body(new ZodPipe(RegisterInput)) body: RegisterInput) {
    return this.auth.register(body);
  }

  @Public()
  @Post('login')
  login(@Body(new ZodPipe(LoginInput)) body: LoginInput) {
    return this.auth.login(body);
  }

  @Get('me')
  me(@UserId() userId: string) {
    return this.auth.me(userId);
  }
}
