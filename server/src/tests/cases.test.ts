import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, casesTable, caseTagsTable, caseCollaboratorsTable } from '../db/schema';
import { type CasesQueryInput, type CreateCaseInput } from '../schema';
import { getCases } from '../handlers/cases';
import { eq } from 'drizzle-orm';

// Test users
const testUser1 = {
  name: 'Dr. Smith',
  email: 'smith@example.com',
  password: 'hashedpassword123',
  professionalType: 'clinician' as const,
  isVerified: true
};

const testUser2 = {
  name: 'Dr. Johnson',
  email: 'johnson@example.com',
  password: 'hashedpassword456',
  professionalType: 'specialist' as const,
  isVerified: true
};

// Test cases
const testCase1 = {
  title: 'Crown Case 1',
  description: 'A complex crown case requiring consultation',
  caseType: 'crown' as const,
  priority: 'high' as const,
  patientAge: 45,
  isPublic: true,
  status: 'active' as const
};

const testCase2 = {
  title: 'Bridge Case 1',
  description: 'Multi-unit bridge restoration',
  caseType: 'bridge' as const,
  priority: 'medium' as const,
  patientAge: 55,
  isPublic: false,
  status: 'draft' as const
};

const testCase3 = {
  title: 'Implant Case 1',
  description: 'Single implant placement',
  caseType: 'implant' as const,
  priority: 'urgent' as const,
  patientAge: 35,
  isPublic: true,
  status: 'in_progress' as const
};

describe('getCases', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return public cases for anonymous users', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([testUser1, testUser2])
      .returning()
      .execute();

    const user1Id = users[0].id;
    const user2Id = users[1].id;

    // Create test cases
    await db.insert(casesTable)
      .values([
        { ...testCase1, creatorId: user1Id },
        { ...testCase2, creatorId: user1Id }, // Private case
        { ...testCase3, creatorId: user2Id }
      ])
      .execute();

    const query: CasesQueryInput = {};
    const result = await getCases(query);

    // Should only return public cases (testCase1 and testCase3)
    expect(result).toHaveLength(2);
    expect(result.every(c => c.isPublic === true)).toBe(true);
    
    // Should be sorted by newest first (default) - check dates instead of assuming order
    expect(result[0].createdAt >= result[1].createdAt).toBe(true);
  });

  it('should return public cases + own cases + collaborated cases for authenticated users', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([testUser1, testUser2])
      .returning()
      .execute();

    const user1Id = users[0].id;
    const user2Id = users[1].id;

    // Create test cases
    const cases = await db.insert(casesTable)
      .values([
        { ...testCase1, creatorId: user1Id }, // Public case by user1
        { ...testCase2, creatorId: user1Id }, // Private case by user1
        { ...testCase3, creatorId: user2Id }  // Public case by user2
      ])
      .returning()
      .execute();

    // Add collaboration on user2's case for user1
    await db.insert(caseCollaboratorsTable)
      .values({
        caseId: cases[2].id, // testCase3
        userId: user1Id,
        role: 'viewer'
      })
      .execute();

    const query: CasesQueryInput = {};
    const result = await getCases(query, user1Id);

    // Should return all 3 cases: public by user1, private by user1, collaborated case by user2
    expect(result).toHaveLength(3);
    
    // Check that user1 can see their own private case
    const privateCase = result.find(c => c.title === 'Bridge Case 1');
    expect(privateCase).toBeDefined();
    expect(privateCase?.isPublic).toBe(false);
  });

  it('should filter cases by type', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([testUser1])
      .returning()
      .execute();

    const userId = users[0].id;

    // Create test cases with different types
    await db.insert(casesTable)
      .values([
        { ...testCase1, creatorId: userId }, // crown
        { ...testCase2, creatorId: userId, isPublic: true }, // bridge
        { ...testCase3, creatorId: userId }  // implant
      ])
      .execute();

    const query: CasesQueryInput = {
      caseType: 'crown'
    };
    const result = await getCases(query, userId);

    expect(result).toHaveLength(1);
    expect(result[0].caseType).toEqual('crown');
    expect(result[0].title).toEqual('Crown Case 1');
  });

  it('should filter cases by priority', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([testUser1])
      .returning()
      .execute();

    const userId = users[0].id;

    // Create test cases with different priorities
    await db.insert(casesTable)
      .values([
        { ...testCase1, creatorId: userId }, // high
        { ...testCase2, creatorId: userId, isPublic: true }, // medium
        { ...testCase3, creatorId: userId }  // urgent
      ])
      .execute();

    const query: CasesQueryInput = {
      priority: 'urgent'
    };
    const result = await getCases(query, userId);

    expect(result).toHaveLength(1);
    expect(result[0].priority).toEqual('urgent');
    expect(result[0].title).toEqual('Implant Case 1');
  });

  it('should filter cases by status', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([testUser1])
      .returning()
      .execute();

    const userId = users[0].id;

    // Create test cases with different statuses
    await db.insert(casesTable)
      .values([
        { ...testCase1, creatorId: userId }, // active
        { ...testCase2, creatorId: userId, isPublic: true }, // draft
        { ...testCase3, creatorId: userId }  // in_progress
      ])
      .execute();

    const query: CasesQueryInput = {
      status: 'draft'
    };
    const result = await getCases(query, userId);

    expect(result).toHaveLength(1);
    expect(result[0].status).toEqual('draft');
    expect(result[0].title).toEqual('Bridge Case 1');
  });

  it('should filter cases by creator', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([testUser1, testUser2])
      .returning()
      .execute();

    const user1Id = users[0].id;
    const user2Id = users[1].id;

    // Create test cases
    await db.insert(casesTable)
      .values([
        { ...testCase1, creatorId: user1Id },
        { ...testCase2, creatorId: user1Id, isPublic: true },
        { ...testCase3, creatorId: user2Id }
      ])
      .execute();

    const query: CasesQueryInput = {
      creatorId: user1Id
    };
    const result = await getCases(query, user1Id);

    expect(result).toHaveLength(2);
    expect(result.every(c => c.creatorId === user1Id)).toBe(true);
  });

  it('should filter cases by tag', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([testUser1])
      .returning()
      .execute();

    const userId = users[0].id;

    // Create test cases
    const cases = await db.insert(casesTable)
      .values([
        { ...testCase1, creatorId: userId },
        { ...testCase2, creatorId: userId, isPublic: true },
        { ...testCase3, creatorId: userId }
      ])
      .returning()
      .execute();

    // Add tags to cases
    await db.insert(caseTagsTable)
      .values([
        { caseId: cases[0].id, tag: 'complex' },
        { caseId: cases[0].id, tag: 'anterior' },
        { caseId: cases[2].id, tag: 'complex' }
      ])
      .execute();

    const query: CasesQueryInput = {
      tag: 'complex'
    };
    const result = await getCases(query, userId);

    expect(result).toHaveLength(2);
    expect(result.map(c => c.title).sort()).toEqual(['Crown Case 1', 'Implant Case 1']);
  });

  it('should filter by public/private status', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([testUser1])
      .returning()
      .execute();

    const userId = users[0].id;

    // Create test cases
    await db.insert(casesTable)
      .values([
        { ...testCase1, creatorId: userId }, // public
        { ...testCase2, creatorId: userId }, // private
        { ...testCase3, creatorId: userId }  // public
      ])
      .execute();

    const query: CasesQueryInput = {
      isPublic: false
    };
    const result = await getCases(query, userId);

    expect(result).toHaveLength(1);
    expect(result[0].isPublic).toBe(false);
    expect(result[0].title).toEqual('Bridge Case 1');
  });

  it('should handle pagination correctly', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([testUser1])
      .returning()
      .execute();

    const userId = users[0].id;

    // Create 5 test cases
    const casesData = [];
    for (let i = 1; i <= 5; i++) {
      casesData.push({
        title: `Case ${i}`,
        description: `Description for case ${i}`,
        caseType: 'crown' as const,
        priority: 'medium' as const,
        isPublic: true,
        status: 'active' as const,
        creatorId: userId
      });
    }

    await db.insert(casesTable)
      .values(casesData)
      .execute();

    // Test first page
    const query1: CasesQueryInput = {
      page: 1,
      limit: 2
    };
    const result1 = await getCases(query1, userId);

    expect(result1).toHaveLength(2);

    // Test second page
    const query2: CasesQueryInput = {
      page: 2,
      limit: 2
    };
    const result2 = await getCases(query2, userId);

    expect(result2).toHaveLength(2);

    // Ensure different results
    expect(result1[0].id).not.toEqual(result2[0].id);
  });

  it('should sort cases by priority correctly', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([testUser1])
      .returning()
      .execute();

    const userId = users[0].id;

    // Create test cases with different priorities
    await db.insert(casesTable)
      .values([
        { ...testCase2, creatorId: userId, isPublic: true }, // medium
        { ...testCase1, creatorId: userId }, // high
        { ...testCase3, creatorId: userId }  // urgent
      ])
      .execute();

    const query: CasesQueryInput = {
      sortBy: 'priority'
    };
    const result = await getCases(query, userId);

    expect(result).toHaveLength(3);
    // Should be sorted: urgent, high, medium
    expect(result[0].priority).toEqual('urgent');
    expect(result[1].priority).toEqual('high');
    expect(result[2].priority).toEqual('medium');
  });

  it('should sort cases by oldest first', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([testUser1])
      .returning()
      .execute();

    const userId = users[0].id;

    // Create test cases (they'll be inserted in order)
    await db.insert(casesTable)
      .values([
        { ...testCase1, creatorId: userId },
        { ...testCase2, creatorId: userId, isPublic: true },
        { ...testCase3, creatorId: userId }
      ])
      .execute();

    const query: CasesQueryInput = {
      sortBy: 'oldest'
    };
    const result = await getCases(query, userId);

    expect(result).toHaveLength(3);
    // Should be sorted by creation time ascending (oldest first)
    expect(result[0].title).toEqual('Crown Case 1');
    expect(result[1].title).toEqual('Bridge Case 1');
    expect(result[2].title).toEqual('Implant Case 1');
  });

  it('should handle multiple filters combined', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([testUser1])
      .returning()
      .execute();

    const userId = users[0].id;

    // Create test cases
    const cases = await db.insert(casesTable)
      .values([
        { 
          title: 'Crown High Case',
          description: 'High priority crown case',
          caseType: 'crown' as const,
          priority: 'high' as const,
          isPublic: true,
          status: 'active' as const,
          creatorId: userId
        },
        { 
          title: 'Crown Medium Case',
          description: 'Medium priority crown case',
          caseType: 'crown' as const,
          priority: 'medium' as const,
          isPublic: true,
          status: 'active' as const,
          creatorId: userId
        },
        { 
          title: 'Bridge High Case',
          description: 'High priority bridge case',
          caseType: 'bridge' as const,
          priority: 'high' as const,
          isPublic: true,
          status: 'active' as const,
          creatorId: userId
        }
      ])
      .returning()
      .execute();

    // Add tag to the crown high case
    await db.insert(caseTagsTable)
      .values({
        caseId: cases[0].id,
        tag: 'urgent-care'
      })
      .execute();

    const query: CasesQueryInput = {
      caseType: 'crown',
      priority: 'high',
      tag: 'urgent-care'
    };
    const result = await getCases(query, userId);

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Crown High Case');
    expect(result[0].caseType).toEqual('crown');
    expect(result[0].priority).toEqual('high');
  });

  it('should return empty array when no cases match filters', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([testUser1])
      .returning()
      .execute();

    const userId = users[0].id;

    // Create test cases
    await db.insert(casesTable)
      .values([
        { ...testCase1, creatorId: userId }
      ])
      .execute();

    const query: CasesQueryInput = {
      caseType: 'orthodontic' // No cases of this type exist
    };
    const result = await getCases(query, userId);

    expect(result).toHaveLength(0);
  });
});