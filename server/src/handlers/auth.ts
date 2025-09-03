import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type LoginInput, type User } from '../schema';
import { eq, and, SQL } from 'drizzle-orm';

/**
 * Register a new user in the system
 * This handler hashes the password, validates email uniqueness,
 * creates the user record in the database, and returns the user profile
 */
export async function registerUser(input: CreateUserInput): Promise<User> {
  try {
    // Check if email already exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUser.length > 0) {
      throw new Error('Email already exists');
    }

    // Hash password (simple hashing for this example - in production use bcrypt)
    const hashedPassword = await hashPassword(input.password);

    // Insert new user
    const result = await db.insert(usersTable)
      .values({
        name: input.name,
        email: input.email,
        password: hashedPassword,
        avatarUrl: input.avatarUrl || null,
        professionalType: input.professionalType,
        isVerified: false
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User registration failed:', error);
    throw error;
  }
}

/**
 * Authenticate user login credentials
 * This handler verifies email/password combination,
 * validates against hashed password, and returns user profile if valid
 */
export async function loginUser(input: LoginInput): Promise<User | null> {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      return null; // User not found
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await verifyPassword(input.password, user.password);
    if (!isValidPassword) {
      return null; // Invalid password
    }

    return user;
  } catch (error) {
    console.error('User login failed:', error);
    throw error;
  }
}

/**
 * Get current authenticated user profile
 * This handler returns user information for the authenticated user
 */
export async function getCurrentUser(userId: number): Promise<User | null> {
  try {
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error('Get current user failed:', error);
    throw error;
  }
}

/**
 * Get user by ID (public profile view)
 * This handler returns public user information
 */
export async function getUserById(userId: number): Promise<User | null> {
  try {
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error('Get user by ID failed:', error);
    throw error;
  }
}

/**
 * List all users with optional filters
 * This handler returns paginated list of users with professional type filtering
 */
export async function getUsers(filters?: { 
  professionalType?: string; 
  page?: number; 
  limit?: number; 
}): Promise<User[]> {
  try {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const offset = (page - 1) * limit;

    // Build conditions array
    const conditions: SQL<unknown>[] = [];
    
    if (filters?.professionalType) {
      conditions.push(eq(usersTable.professionalType, filters.professionalType as any));
    }

    // Build and execute query based on conditions
    let results;
    if (conditions.length > 0) {
      const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
      results = await db.select()
        .from(usersTable)
        .where(whereCondition)
        .limit(limit)
        .offset(offset)
        .execute();
    } else {
      results = await db.select()
        .from(usersTable)
        .limit(limit)
        .offset(offset)
        .execute();
    }

    return results;
  } catch (error) {
    console.error('Get users failed:', error);
    throw error;
  }
}

/**
 * Simple password hashing function
 * In production, use bcrypt or similar library
 */
async function hashPassword(password: string): Promise<string> {
  // Simple hash for demonstration - use bcrypt in production
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify password against hash
 * In production, use bcrypt.compare
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}