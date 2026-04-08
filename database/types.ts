// Database types - re-exported from schema for convenience
export type {
  User,
  NewUser,
  UserProfile,
  NewUserProfile,
  UserSession,
  NewUserSession,
} from './schema';

// Database instance
export { db } from './connection';