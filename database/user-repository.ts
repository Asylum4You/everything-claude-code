import { eq, and, sql } from 'drizzle-orm';
import { db as defaultDb } from './connection';
import { users, userProfiles, userSessions, type User, type NewUser, type UserProfile, type NewUserProfile, type UserSession, type NewUserSession } from './schema';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export class UserRepository {
  private db: BetterSQLite3Database<any>;

  constructor(db?: BetterSQLite3Database<any>) {
    this.db = db || defaultDb;
  }

  // User CRUD operations
  async createUser(data: NewUser): Promise<User> {
    const [user] = await this.db.insert(users).values(data).returning();
    return user;
  }

  async getUserById(id: number): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return user || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return user || null;
  }

  async updateUser(id: number, data: Partial<NewUser>): Promise<User | null> {
    const [user] = await this.db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || null;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await this.db.delete(users).where(eq(users.id, id));
    return result.changes > 0;
  }

  // User Profile operations
  async createUserProfile(data: NewUserProfile): Promise<UserProfile> {
    const [profile] = await this.db.insert(userProfiles).values(data).returning();
    return profile;
  }

  async getUserProfile(userId: number): Promise<UserProfile | null> {
    const [profile] = await this.db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
    return profile || null;
  }

  async updateUserProfile(userId: number, data: Partial<NewUserProfile>): Promise<UserProfile | null> {
    const [profile] = await this.db
      .update(userProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId))
      .returning();
    return profile || null;
  }

  // User Session operations
  async createSession(data: NewUserSession): Promise<UserSession> {
    const [session] = await this.db.insert(userSessions).values(data).returning();
    return session;
  }

  async getSessionByToken(token: string): Promise<UserSession | null> {
    const [session] = await this.db.select().from(userSessions).where(eq(userSessions.sessionToken, token)).limit(1);
    return session || null;
  }

  async deleteSession(token: string): Promise<boolean> {
    const result = await this.db.delete(userSessions).where(eq(userSessions.sessionToken, token));
    return result.changes > 0;
  }

  async deleteExpiredSessions(): Promise<number> {
    const result = await this.db.delete(userSessions).where(sql`${userSessions.expiresAt} < datetime('now')`);
    return result.changes;
  }

  async getUserWithProfile(userId: number) {
    const result = await this.db
      .select({
        user: users,
        profile: userProfiles,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(eq(users.id, userId))
      .limit(1);

    if (result.length === 0) return null;

    const { user, profile } = result[0];
    return { ...user, profile };
  }
}