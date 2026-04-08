import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema';
import { users, userProfiles, userSessions } from '../schema';
import { UserRepository } from '../user-repository';

// Create in-memory database for tests
let sqlite: any;
let db: ReturnType<typeof drizzle>;
let userRepo: UserRepository;

beforeEach(async () => {
  // Create in-memory SQLite database
  sqlite = new Database(':memory:');

  // Enable WAL mode
  sqlite.pragma('journal_mode = WAL');

  // Run migration SQL
  const migrationSQL = `
    CREATE TABLE \`user_profiles\` (
      \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      \`user_id\` integer NOT NULL,
      \`name\` text,
      \`bio\` text,
      \`avatar_url\` text,
      \`created_at\` integer DEFAULT (unixepoch()),
      \`updated_at\` integer DEFAULT (unixepoch()),
      FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );
    CREATE INDEX \`user_profiles_user_id_idx\` ON \`user_profiles\` (\`user_id\`);
    CREATE TABLE \`user_sessions\` (
      \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      \`user_id\` integer NOT NULL,
      \`session_token\` text NOT NULL,
      \`expires_at\` integer NOT NULL,
      \`created_at\` integer DEFAULT (unixepoch()),
      FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );
    CREATE UNIQUE INDEX \`user_sessions_session_token_unique\` ON \`user_sessions\` (\`session_token\`);
    CREATE INDEX \`user_sessions_user_id_idx\` ON \`user_sessions\` (\`user_id\`);
    CREATE INDEX \`user_sessions_token_idx\` ON \`user_sessions\` (\`session_token\`);
    CREATE INDEX \`user_sessions_expires_at_idx\` ON \`user_sessions\` (\`expires_at\`);
    CREATE TABLE \`users\` (
      \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      \`email\` text NOT NULL,
      \`password_hash\` text NOT NULL,
      \`created_at\` integer DEFAULT (unixepoch()),
      \`updated_at\` integer DEFAULT (unixepoch())
    );
    CREATE UNIQUE INDEX \`users_email_unique\` ON \`users\` (\`email\`);
    CREATE INDEX \`users_email_idx\` ON \`users\` (\`email\`);
  `;

  sqlite.exec(migrationSQL);

  // Create Drizzle instance
  db = drizzle(sqlite, { schema });

  // Create repository instance with test db
  userRepo = new UserRepository(db);
});

afterEach(() => {
  // Close database connection
  sqlite.close();
});

describe('UserRepository', () => {
  describe('User CRUD Operations', () => {
    it('should create a new user', async () => {
      const newUser = {
        email: 'test@example.com',
        passwordHash: 'hashedpassword123',
      };

      const user = await userRepo.createUser(newUser);

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.passwordHash).toBe('hashedpassword123');
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should get user by ID', async () => {
      const newUser = {
        email: 'test2@example.com',
        passwordHash: 'hashedpassword123',
      };

      const createdUser = await userRepo.createUser(newUser);
      const retrievedUser = await userRepo.getUserById(createdUser.id);

      expect(retrievedUser).toBeDefined();
      expect(retrievedUser!.id).toBe(createdUser.id);
      expect(retrievedUser!.email).toBe('test2@example.com');
    });

    it('should get user by email', async () => {
      const newUser = {
        email: 'test3@example.com',
        passwordHash: 'hashedpassword123',
      };

      await userRepo.createUser(newUser);
      const retrievedUser = await userRepo.getUserByEmail('test3@example.com');

      expect(retrievedUser).toBeDefined();
      expect(retrievedUser!.email).toBe('test3@example.com');
    });

    it('should return null for non-existent user', async () => {
      const user = await userRepo.getUserById(999);
      expect(user).toBeNull();
    });

    it('should update user', async () => {
      const newUser = {
        email: 'test4@example.com',
        passwordHash: 'hashedpassword123',
      };

      const createdUser = await userRepo.createUser(newUser);
      const updatedUser = await userRepo.updateUser(createdUser.id, {
        email: 'updated@example.com',
      });

      expect(updatedUser).toBeDefined();
      expect(updatedUser!.email).toBe('updated@example.com');
      expect(updatedUser!.id).toBe(createdUser.id);
      expect(updatedUser!.updatedAt).toBeInstanceOf(Date);
    });

    it('should delete user', async () => {
      const newUser = {
        email: 'test5@example.com',
        passwordHash: 'hashedpassword123',
      };

      const createdUser = await userRepo.createUser(newUser);
      const deleted = await userRepo.deleteUser(createdUser.id);

      expect(deleted).toBe(true);

      const retrievedUser = await userRepo.getUserById(createdUser.id);
      expect(retrievedUser).toBeNull();
    });
  });

  describe('User Profile Operations', () => {
    it('should create and get user profile', async () => {
      const newUser = {
        email: 'test6@example.com',
        passwordHash: 'hashedpassword123',
      };

      const user = await userRepo.createUser(newUser);
      const newProfile = {
        userId: user.id,
        name: 'Test User',
        bio: 'A test user',
      };

      const profile = await userRepo.createUserProfile(newProfile);
      const retrievedProfile = await userRepo.getUserProfile(user.id);

      expect(profile).toBeDefined();
      expect(retrievedProfile).toBeDefined();
      expect(retrievedProfile!.name).toBe('Test User');
      expect(retrievedProfile!.bio).toBe('A test user');
    });

    it('should update user profile', async () => {
      const newUser = {
        email: 'test7@example.com',
        passwordHash: 'hashedpassword123',
      };

      const user = await userRepo.createUser(newUser);
      const newProfile = {
        userId: user.id,
        name: 'Test User',
      };

      await userRepo.createUserProfile(newProfile);
      const updatedProfile = await userRepo.updateUserProfile(user.id, {
        name: 'Updated Name',
        bio: 'Updated bio',
      });

      expect(updatedProfile).toBeDefined();
      expect(updatedProfile!.name).toBe('Updated Name');
      expect(updatedProfile!.bio).toBe('Updated bio');
    });
  });

  describe('User Session Operations', () => {
    it('should create and get session by token', async () => {
      const newUser = {
        email: 'test8@example.com',
        passwordHash: 'hashedpassword123',
      };

      const user = await userRepo.createUser(newUser);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      const newSession = {
        userId: user.id,
        sessionToken: 'session-token-123',
        expiresAt,
      };

      const session = await userRepo.createSession(newSession);
      const retrievedSession = await userRepo.getSessionByToken('session-token-123');

      expect(session).toBeDefined();
      expect(retrievedSession).toBeDefined();
      expect(retrievedSession!.sessionToken).toBe('session-token-123');
      expect(retrievedSession!.userId).toBe(user.id);
    });

    it('should delete session', async () => {
      const newUser = {
        email: 'test9@example.com',
        passwordHash: 'hashedpassword123',
      };

      const user = await userRepo.createUser(newUser);
      const newSession = {
        userId: user.id,
        sessionToken: 'session-token-456',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      await userRepo.createSession(newSession);
      const deleted = await userRepo.deleteSession('session-token-456');

      expect(deleted).toBe(true);

      const retrievedSession = await userRepo.getSessionByToken('session-token-456');
      expect(retrievedSession).toBeNull();
    });
  });

  describe('Complex Queries', () => {
    it('should get user with profile', async () => {
      const newUser = {
        email: 'test10@example.com',
        passwordHash: 'hashedpassword123',
      };

      const user = await userRepo.createUser(newUser);
      const newProfile = {
        userId: user.id,
        name: 'Test User',
        bio: 'A test user',
      };

      await userRepo.createUserProfile(newProfile);
      const userWithProfile = await userRepo.getUserWithProfile(user.id);

      expect(userWithProfile).toBeDefined();
      expect(userWithProfile!.email).toBe('test10@example.com');
      expect(userWithProfile!.profile).toBeDefined();
      expect(userWithProfile!.profile!.name).toBe('Test User');
    });
  });
});