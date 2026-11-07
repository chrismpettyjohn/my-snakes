import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import type { AuthResponse, LoginInput, RegisterInput } from "@snake/shared";
import { JWT_SECRET } from "../config";
import { DB, type Db } from "../db/db.module";
import { homeMembers, homes, users } from "../db/schema";

const secret = () => new TextEncoder().encode(JWT_SECRET);

@Injectable()
export class AuthService {
  constructor(@Inject(DB) private db: Db) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const email = input.email.toLowerCase();
    const [existing] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) throw new ConflictException("Email already registered");
    const passwordHash = await Bun.password.hash(input.password);
    const user = await this.db.transaction(async (tx) => {
      const [u] = await tx.insert(users).values({ email, passwordHash, displayName: input.displayName }).returning();
      const [h] = await tx.insert(homes).values({ name: `${input.displayName}'s Collection` }).returning();
      await tx.insert(homeMembers).values({ homeId: h!.id, userId: u!.id, role: "owner" });
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

  async me(userId: string) {
    const [u] = await this.db.select({ id: users.id, email: users.email, displayName: users.displayName })
      .from(users).where(eq(users.id, userId));
    if (!u) throw new UnauthorizedException();
    return u;
  }

  async verify(token: string): Promise<string> {
    const { payload } = await jwtVerify(token, secret());
    return payload.sub!;
  }

  private async issue(u: { id: string; email: string; displayName: string }): Promise<AuthResponse> {
    const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" })
      .setSubject(u.id).setIssuedAt().setExpirationTime("30d").sign(secret());
    return { token, user: { id: u.id, email: u.email, displayName: u.displayName } };
  }
}
