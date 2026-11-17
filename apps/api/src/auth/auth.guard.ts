import {bearerToken} from './bearer';
import {Reflector} from '@nestjs/core';
import {AuthService} from './auth.service';
import {type CanActivate, type ExecutionContext, Injectable, SetMetadata, UnauthorizedException, createParamDecorator} from '@nestjs/common';

export const Public = () => SetMetadata('public', true);
export const UserId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => ctx.switchToHttp().getRequest().userId);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>('public', [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest();
    const token = bearerToken(req.headers.authorization);
    if (!token) throw new UnauthorizedException();
    try {
      req.userId = await this.auth.verify(token);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
