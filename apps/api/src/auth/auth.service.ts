import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import type { AuthResponse, LoginInput, RegisterInput, User } from "@snake/shared";
import { JWT_SECRET } from "../config";
import { DB, type Db } from "../db/db.module";
import { users } from "../db/schema";
import { HomeService } from "../home/home.service";

const secret = new TextEncoder().encode(JWT_SECRET);
const publicUser = { id: users.id, email: users.email, displayName: users.displayName };

@Injectable()
export class AuthService {
  constructor(@Inject(DB) private db: Db, private home: HomeService) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const email = input.email.toLowerCase();
    const [existing] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) throw new ConflictException("Email already registered");
    const passwordHash = await Bun.password.hash(input.password);
    const user = await this.db.transaction(async (tx) => {
      const [u] = await tx.insert(users).values({ email, passwordHash, displayName: input.displayName }).returning(publicUser);
      await this.home.create(u!.id, `${input.displayName}'s Collection`, tx);
      return u!;
    });
    return this.issue(user);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const [u] = await this.db.select().from(users).where(eq(users.email, input.email.toLowerCase()));
    if (!u || !(await Bun.password.verify(input.password, u.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }
    return this.issue(u);
  }

  async me(userId: string): Promise<User> {
    const [u] = await this.db.select(publicUser).from(users).where(eq(users.id, userId));
    if (!u) throw new UnauthorizedException();
    return u;
  }

  async verify(token: string): Promise<string> {
    const { payload } = await jwtVerify(token, secret);
    return payload.sub!;
  }

  private async issue(u: User): Promise<AuthResponse> {
    const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" })
      .setSubject(u.id).setIssuedAt().setExpirationTime("30d").sign(secret);
    return { token, user: { id: u.id, email: u.email, displayName: u.displayName } };
  }
}
