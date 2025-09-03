import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type LoginInput } from '../schema';
import { 
  registerUser, 
  loginUser, 
  getCurrentUser, 
  getUserById, 
  getUsers 
} from '../handlers/auth';
import { eq } from 'drizzle-orm';

// Test input data
const testUserInput: CreateUserInput = {
  name: 'Dr. Jane Smith',
  email: 'jane.smith@example.com',
  password: 'securePassword123',
  avatarUrl: 'https://example.com/avatar.jpg',
  professionalType: 'clinician'
};

const testUserInput2: CreateUserInput = {
  name: 'Tech Mike Johnson',
  email: 'mike.johnson@example.com',
  password: 'anotherPassword456',
  professionalType: 'lab_technician'
};

const loginInput: LoginInput = {
  email: 'jane.smith@example.com',
  password: 'securePassword123'
};

describe('Auth Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('registerUser', () => {
    it('should create a new user with hashed password', async () => {
      const result = await registerUser(testUserInput);

      // Verify returned user data
      expect(result.name).toEqual('Dr. Jane Smith');
      expect(result.email).toEqual('jane.smith@example.com');
      expect(result.avatarUrl).toEqual('https://example.com/avatar.jpg');
      expect(result.professionalType).toEqual('clinician');
      expect(result.isVerified).toEqual(false);
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
      
      // Password should be hashed, not plain text
      expect(result.password).not.toEqual('securePassword123');
      expect(result.password.length).toBeGreaterThan(0);
    });

    it('should save user to database', async () => {
      const result = await registerUser(testUserInput);

      // Query database to verify user was saved
      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, result.id))
        .execute();

      expect(users).toHaveLength(1);
      expect(users[0].name).toEqual('Dr. Jane Smith');
      expect(users[0].email).toEqual('jane.smith@example.com');
      expect(users[0].professionalType).toEqual('clinician');
    });

    it('should handle nullable avatarUrl', async () => {
      const inputWithoutAvatar = { ...testUserInput, avatarUrl: undefined };
      const result = await registerUser(inputWithoutAvatar);

      expect(result.avatarUrl).toBeNull();
    });

    it('should reject duplicate email addresses', async () => {
      // Register first user
      await registerUser(testUserInput);

      // Attempt to register another user with same email
      const duplicateInput = { ...testUserInput, name: 'Different Name' };

      await expect(registerUser(duplicateInput)).rejects.toThrow(/email already exists/i);
    });
  });

  describe('loginUser', () => {
    it('should authenticate user with correct credentials', async () => {
      // First register a user
      await registerUser(testUserInput);

      // Then attempt login
      const result = await loginUser(loginInput);

      expect(result).toBeDefined();
      expect(result!.email).toEqual('jane.smith@example.com');
      expect(result!.name).toEqual('Dr. Jane Smith');
      expect(result!.professionalType).toEqual('clinician');
    });

    it('should return null for non-existent email', async () => {
      const invalidLogin: LoginInput = {
        email: 'nonexistent@example.com',
        password: 'anyPassword'
      };

      const result = await loginUser(invalidLogin);
      expect(result).toBeNull();
    });

    it('should return null for incorrect password', async () => {
      // Register user first
      await registerUser(testUserInput);

      // Attempt login with wrong password
      const wrongPasswordLogin: LoginInput = {
        email: 'jane.smith@example.com',
        password: 'wrongPassword'
      };

      const result = await loginUser(wrongPasswordLogin);
      expect(result).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    it('should return user by ID', async () => {
      const registeredUser = await registerUser(testUserInput);

      const result = await getCurrentUser(registeredUser.id);

      expect(result).toBeDefined();
      expect(result!.id).toEqual(registeredUser.id);
      expect(result!.email).toEqual('jane.smith@example.com');
      expect(result!.name).toEqual('Dr. Jane Smith');
    });

    it('should return null for non-existent user ID', async () => {
      const result = await getCurrentUser(999);
      expect(result).toBeNull();
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      const registeredUser = await registerUser(testUserInput);

      const result = await getUserById(registeredUser.id);

      expect(result).toBeDefined();
      expect(result!.id).toEqual(registeredUser.id);
      expect(result!.email).toEqual('jane.smith@example.com');
      expect(result!.name).toEqual('Dr. Jane Smith');
    });

    it('should return null for non-existent user ID', async () => {
      const result = await getUserById(999);
      expect(result).toBeNull();
    });
  });

  describe('getUsers', () => {
    it('should return all users when no filters applied', async () => {
      // Create multiple users
      await registerUser(testUserInput);
      await registerUser(testUserInput2);

      const result = await getUsers();

      expect(result).toHaveLength(2);
      expect(result[0].name).toEqual('Dr. Jane Smith');
      expect(result[1].name).toEqual('Tech Mike Johnson');
    });

    it('should filter by professional type', async () => {
      // Create users with different professional types
      await registerUser(testUserInput); // clinician
      await registerUser(testUserInput2); // lab_technician

      const result = await getUsers({ professionalType: 'clinician' });

      expect(result).toHaveLength(1);
      expect(result[0].professionalType).toEqual('clinician');
      expect(result[0].name).toEqual('Dr. Jane Smith');
    });

    it('should handle pagination', async () => {
      // Create multiple users
      await registerUser(testUserInput);
      await registerUser(testUserInput2);
      await registerUser({
        ...testUserInput,
        email: 'third@example.com',
        name: 'Third User'
      });

      // Get first page with limit 2
      const page1 = await getUsers({ page: 1, limit: 2 });
      expect(page1).toHaveLength(2);

      // Get second page with limit 2
      const page2 = await getUsers({ page: 2, limit: 2 });
      expect(page2).toHaveLength(1);
    });

    it('should return empty array when no users match filter', async () => {
      await registerUser(testUserInput); // clinician

      const result = await getUsers({ professionalType: 'educator' });
      expect(result).toHaveLength(0);
    });

    it('should use default pagination values', async () => {
      // Create multiple users to test default limit
      for (let i = 0; i < 15; i++) {
        await registerUser({
          ...testUserInput,
          email: `user${i}@example.com`,
          name: `User ${i}`
        });
      }

      const result = await getUsers();
      // Default limit should be 10
      expect(result).toHaveLength(10);
    });

    it('should combine filters and pagination', async () => {
      // Create mixed professional types
      await registerUser(testUserInput); // clinician
      await registerUser(testUserInput2); // lab_technician
      await registerUser({
        ...testUserInput,
        email: 'another.clinician@example.com',
        name: 'Another Clinician',
        professionalType: 'clinician'
      });

      const result = await getUsers({
        professionalType: 'clinician',
        page: 1,
        limit: 1
      });

      expect(result).toHaveLength(1);
      expect(result[0].professionalType).toEqual('clinician');
    });
  });
});