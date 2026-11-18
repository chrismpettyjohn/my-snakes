import {eq} from 'drizzle-orm';
import {users} from '../db/schema';
import {JWT_SECRET} from '../config';
import {SignJWT, jwtVerify} from 'jose';
import {DB, type Db} from '../db/db.module';
import {encryptSecret} from '../common/crypto';
import {HomeService} from '../home/home.service';
import type {AuthResponse, User} from '@snake/shared';
import {avatarUrl, exchangeCode, fetchMe} from './discord.client';
import {BadGatewayException, ConflictException, ForbiddenException, Inject, Injectable, UnauthorizedException} from '@nestjs/common';

const secret = new TextEncoder().encode(JWT_SECRET);
const userCols = {
  id: users.id,
  discordId: users.discordId,
  username: users.username,
  email: users.email,
  displayName: users.displayName,
  avatar: users.avatar,
};
type UserRow = {id: string; discordId: string | null; username: string | null; email: string; displayName: string; avatar: string | null};

const toUser = (u: UserRow): User => ({
  id: u.id,
  username: u.username,
  email: u.email,
  displayName: u.displayName,
  avatarUrl: avatarUrl(u.discordId, u.avatar),
});

const isUniqueViolation = (e: unknown) => (e as {code?: string})?.code === '23505';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private db: Db,
    private home: HomeService,
  ) {}

  async discordLogin(code: string): Promise<AuthResponse> {
    let tokens, d;
    try {
      tokens = await exchangeCode(code);
      d = await fetchMe(tokens.access_token);
    } catch {
      throw new BadGatewayException('Discord sign-in failed. Please try again.');
    }
    if (!d.email || !d.verified) throw new ForbiddenException('Your Discord account needs a verified email address to sign in.');
    const profile = {
      discordId: d.id,
      username: d.username,
      email: d.email.toLowerCase(),
      displayName: d.global_name || d.username,
      avatar: d.avatar,
      discordAccessTokenEnc: await encryptSecret(tokens.access_token),
      discordRefreshTokenEnc: await encryptSecret(tokens.refresh_token),
      discordTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    };

    try {
      const user = await this.db.transaction(async tx => {
        const [byDiscord] = await tx.select({id: users.id}).from(users).where(eq(users.discordId, d.id));
        const [byEmail] = byDiscord
          ? []
          : await tx.select({id: users.id, discordId: users.discordId}).from(users).where(eq(users.email, profile.email));
        if (byEmail?.discordId) throw new ConflictException('That email is already linked to a different Discord account.');
        const existing = byDiscord ?? byEmail;
        if (existing) {
          const [u] = await tx.update(users).set(profile).where(eq(users.id, existing.id)).returning(userCols);
          return u!;
        }
        const [u] = await tx.insert(users).values(profile).returning(userCols);
        await this.home.create(u!.id, `${u!.displayName}'s Collection`, tx);
        return u!;
      });
      return this.issue(user);
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('That email is already linked to a different Discord account.');
      throw e;
    }
  }

  async me(userId: string): Promise<User> {
    const [u] = await this.db.select(userCols).from(users).where(eq(users.id, userId));
    if (!u) throw new UnauthorizedException();
    return toUser(u);
  }

  async verify(token: string): Promise<string> {
    const {payload} = await jwtVerify(token, secret);
    return payload.sub!;
  }

  private async issue(u: UserRow): Promise<AuthResponse> {
    const token = await new SignJWT({}).setProtectedHeader({alg: 'HS256'}).setSubject(u.id).setIssuedAt().setExpirationTime('30d').sign(secret);
    return {token, user: toUser(u)};
  }
}
