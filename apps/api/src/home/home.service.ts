import {eq} from 'drizzle-orm';
import {avatarUrl} from '../auth/discord.client';
import {DB, type Db, type Tx} from '../db/db.module';
import {homeMembers, homes, users} from '../db/schema';
import type {Home, Member, UpdateHomeInput} from '@snake/shared';
import {Inject, Injectable, NotFoundException} from '@nestjs/common';

@Injectable()
export class HomeService {
  constructor(@Inject(DB) private db: Db) {}

  forUser(userId: string): Promise<Home[]> {
    return this.db
      .select({id: homes.id, name: homes.name, icon: homes.icon, color: homes.color, role: homeMembers.role})
      .from(homeMembers)
      .innerJoin(homes, eq(homes.id, homeMembers.homeId))
      .where(eq(homeMembers.userId, userId))
      .orderBy(homes.createdAt);
  }

  async create(userId: string, name: string, tx?: Tx): Promise<Home> {
    if (!tx) return this.db.transaction(t => this.create(userId, name, t));
    const [h] = await tx.insert(homes).values({name}).returning();
    await tx.insert(homeMembers).values({homeId: h!.id, userId, role: 'owner'});
    return {id: h!.id, name: h!.name, icon: h!.icon, color: h!.color, role: 'owner'};
  }

  async update(homeId: string, input: UpdateHomeInput) {
    await this.db.update(homes).set(input).where(eq(homes.id, homeId));
  }

  async members(homeId: string): Promise<Member[]> {
    const rows = await this.db
      .select({
        id: users.id,
        discordId: users.discordId,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
        avatar: users.avatar,
        role: homeMembers.role,
      })
      .from(homeMembers)
      .innerJoin(users, eq(users.id, homeMembers.userId))
      .where(eq(homeMembers.homeId, homeId));
    return rows.map(r => ({
      id: r.id,
      username: r.username,
      email: r.email,
      displayName: r.displayName,
      avatarUrl: avatarUrl(r.discordId, r.avatar),
      role: r.role,
    }));
  }

  async addMember(homeId: string, username: string) {
    const [u] = await this.db.select({id: users.id}).from(users).where(eq(users.username, username));
    if (!u) throw new NotFoundException('No MySnakes user with that Discord username');
    await this.db.insert(homeMembers).values({homeId, userId: u.id, role: 'member'}).onConflictDoNothing();
  }
}
