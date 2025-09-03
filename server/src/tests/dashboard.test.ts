import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
    usersTable, 
    casesTable, 
    forumCategoriesTable,
    forumPostsTable,
    forumCommentsTable,
    userPostVotesTable,
    activityLogsTable
} from '../db/schema';
import { type CreateActivityLogInput } from '../schema';
import { 
    getDashboardStats, 
    getActivityFeed, 
    createActivityLog, 
    getUserActivity 
} from '../handlers/dashboard';
import { eq } from 'drizzle-orm';

describe('Dashboard Handlers', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    // Helper function to create test user
    const createTestUser = async () => {
        const userResult = await db.insert(usersTable).values({
            name: 'Test User',
            email: 'test@example.com',
            password: 'hashedpassword',
            professionalType: 'clinician',
            isVerified: true
        }).returning().execute();
        return userResult[0];
    };

    // Helper function to create test category
    const createTestCategory = async () => {
        const categoryResult = await db.insert(forumCategoriesTable).values({
            name: 'Test Category',
            description: 'A category for testing'
        }).returning().execute();
        return categoryResult[0];
    };

    describe('getDashboardStats', () => {
        it('should return dashboard statistics with zero values for empty database', async () => {
            const stats = await getDashboardStats();

            expect(stats.totalCases).toBe(0);
            expect(stats.activeCases).toBe(0);
            expect(stats.totalPosts).toBe(0);
            expect(stats.activeUsers).toBe(0);
            expect(stats.totalEngagement).toBe(0);
        });

        it('should calculate correct statistics with data', async () => {
            // Create test user
            const user = await createTestUser();
            const category = await createTestCategory();

            // Create test cases
            await db.insert(casesTable).values([
                {
                    title: 'Active Case',
                    description: 'An active case',
                    caseType: 'crown',
                    priority: 'medium',
                    creatorId: user.id,
                    status: 'active',
                    isPublic: true
                },
                {
                    title: 'Draft Case',
                    description: 'A draft case',
                    caseType: 'bridge',
                    priority: 'low',
                    creatorId: user.id,
                    status: 'draft',
                    isPublic: false
                }
            ]).execute();

            // Create test forum posts
            const postResult = await db.insert(forumPostsTable).values({
                title: 'Test Post',
                content: 'Test content',
                authorId: user.id,
                categoryId: category.id
            }).returning().execute();
            const post = postResult[0];

            // Create test comment
            await db.insert(forumCommentsTable).values({
                postId: post.id,
                authorId: user.id,
                content: 'Test comment'
            }).execute();

            // Create test vote
            await db.insert(userPostVotesTable).values({
                userId: user.id,
                postId: post.id,
                voteType: 'up'
            }).execute();

            const stats = await getDashboardStats();

            expect(stats.totalCases).toBe(2);
            expect(stats.activeCases).toBe(1); // Only the active case
            expect(stats.totalPosts).toBe(1);
            expect(stats.activeUsers).toBe(1);
            expect(stats.totalEngagement).toBe(2); // 1 comment + 1 vote
        });
    });

    describe('createActivityLog', () => {
        it('should create an activity log entry', async () => {
            const user = await createTestUser();

            const input: CreateActivityLogInput = {
                userId: user.id,
                type: 'case_created',
                title: 'Case Created',
                description: 'User created a new case',
                metadata: JSON.stringify({ caseId: 123 })
            };

            const result = await createActivityLog(input);

            expect(result.userId).toBe(user.id);
            expect(result.type).toBe('case_created');
            expect(result.title).toBe('Case Created');
            expect(result.description).toBe('User created a new case');
            expect(result.metadata).toBe(JSON.stringify({ caseId: 123 }));
            expect(result.id).toBeDefined();
            expect(result.timestamp).toBeInstanceOf(Date);
        });

        it('should create activity log entry with null metadata', async () => {
            const user = await createTestUser();

            const input: CreateActivityLogInput = {
                userId: user.id,
                type: 'post_created',
                title: 'Post Created',
                description: 'User created a new post'
            };

            const result = await createActivityLog(input);

            expect(result.metadata).toBeNull();
            expect(result.type).toBe('post_created');
        });

        it('should save activity log to database', async () => {
            const user = await createTestUser();

            const input: CreateActivityLogInput = {
                userId: user.id,
                type: 'comment_added',
                title: 'Comment Added',
                description: 'User added a comment'
            };

            const result = await createActivityLog(input);

            // Verify it's in the database
            const activities = await db.select()
                .from(activityLogsTable)
                .where(eq(activityLogsTable.id, result.id))
                .execute();

            expect(activities).toHaveLength(1);
            expect(activities[0].userId).toBe(user.id);
            expect(activities[0].type).toBe('comment_added');
            expect(activities[0].title).toBe('Comment Added');
        });
    });

    describe('getActivityFeed', () => {
        it('should return empty array when no activities exist', async () => {
            const activities = await getActivityFeed();

            expect(activities).toEqual([]);
        });

        it('should return activities ordered by timestamp descending', async () => {
            const user = await createTestUser();

            // Create multiple activity logs with slight delay to ensure different timestamps
            await createActivityLog({
                userId: user.id,
                type: 'case_created',
                title: 'First Activity',
                description: 'First activity description'
            });

            // Small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 10));

            await createActivityLog({
                userId: user.id,
                type: 'post_created',
                title: 'Second Activity',
                description: 'Second activity description'
            });

            const activities = await getActivityFeed();

            expect(activities).toHaveLength(2);
            expect(activities[0].title).toBe('Second Activity'); // Most recent first
            expect(activities[1].title).toBe('First Activity');
            expect(activities[0].timestamp >= activities[1].timestamp).toBe(true);
        });

        it('should filter activities by userId when specified', async () => {
            const user1 = await createTestUser();
            
            const user2Result = await db.insert(usersTable).values({
                name: 'Test User 2',
                email: 'test2@example.com',
                password: 'hashedpassword',
                professionalType: 'student'
            }).returning().execute();
            const user2 = user2Result[0];

            // Create activities for both users
            await createActivityLog({
                userId: user1.id,
                type: 'case_created',
                title: 'User 1 Activity',
                description: 'Activity by user 1'
            });

            await createActivityLog({
                userId: user2.id,
                type: 'post_created',
                title: 'User 2 Activity',
                description: 'Activity by user 2'
            });

            const user1Activities = await getActivityFeed({ userId: user1.id });

            expect(user1Activities).toHaveLength(1);
            expect(user1Activities[0].userId).toBe(user1.id);
            expect(user1Activities[0].title).toBe('User 1 Activity');
        });

        it('should handle pagination correctly', async () => {
            const user = await createTestUser();

            // Create 5 activities
            for (let i = 1; i <= 5; i++) {
                await createActivityLog({
                    userId: user.id,
                    type: 'case_created',
                    title: `Activity ${i}`,
                    description: `Description ${i}`
                });
                // Small delay to ensure different timestamps
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Test first page with limit of 3
            const firstPage = await getActivityFeed({ page: 1, limit: 3 });
            expect(firstPage).toHaveLength(3);

            // Test second page
            const secondPage = await getActivityFeed({ page: 2, limit: 3 });
            expect(secondPage).toHaveLength(2);

            // Ensure no overlap between pages
            const firstPageTitles = firstPage.map(a => a.title);
            const secondPageTitles = secondPage.map(a => a.title);
            const intersection = firstPageTitles.filter(title => secondPageTitles.includes(title));
            expect(intersection).toHaveLength(0);
        });

        it('should use default pagination values', async () => {
            const user = await createTestUser();

            // Create more than 20 activities (default limit)
            for (let i = 1; i <= 25; i++) {
                await createActivityLog({
                    userId: user.id,
                    type: 'case_created',
                    title: `Activity ${i}`,
                    description: `Description ${i}`
                });
            }

            const activities = await getActivityFeed();

            // Should return default limit of 20
            expect(activities).toHaveLength(20);
        });
    });

    describe('getUserActivity', () => {
        it('should return empty array for user with no activities', async () => {
            const user = await createTestUser();

            const activities = await getUserActivity(user.id);

            expect(activities).toEqual([]);
        });

        it('should return only activities for specified user', async () => {
            const user1 = await createTestUser();
            
            const user2Result = await db.insert(usersTable).values({
                name: 'Test User 2',
                email: 'test2@example.com',
                password: 'hashedpassword',
                professionalType: 'educator'
            }).returning().execute();
            const user2 = user2Result[0];

            // Create activities for both users
            await createActivityLog({
                userId: user1.id,
                type: 'case_created',
                title: 'User 1 Activity',
                description: 'Activity by user 1'
            });

            await createActivityLog({
                userId: user2.id,
                type: 'post_created',
                title: 'User 2 Activity',
                description: 'Activity by user 2'
            });

            const user1Activities = await getUserActivity(user1.id);

            expect(user1Activities).toHaveLength(1);
            expect(user1Activities[0].userId).toBe(user1.id);
            expect(user1Activities[0].title).toBe('User 1 Activity');
        });

        it('should handle pagination for user activities', async () => {
            const user = await createTestUser();

            // Create 5 activities for the user
            for (let i = 1; i <= 5; i++) {
                await createActivityLog({
                    userId: user.id,
                    type: 'case_created',
                    title: `User Activity ${i}`,
                    description: `User description ${i}`
                });
                // Small delay to ensure different timestamps
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Test first page with limit of 2
            const firstPage = await getUserActivity(user.id, { page: 1, limit: 2 });
            expect(firstPage).toHaveLength(2);

            // Test second page
            const secondPage = await getUserActivity(user.id, { page: 2, limit: 2 });
            expect(secondPage).toHaveLength(2);

            // Test third page
            const thirdPage = await getUserActivity(user.id, { page: 3, limit: 2 });
            expect(thirdPage).toHaveLength(1);

            // Verify all activities are returned with pagination
            const allActivities = [...firstPage, ...secondPage, ...thirdPage];
            expect(allActivities).toHaveLength(5);
        });

        it('should return activities in descending timestamp order', async () => {
            const user = await createTestUser();

            await createActivityLog({
                userId: user.id,
                type: 'case_created',
                title: 'First Activity',
                description: 'First activity'
            });

            // Small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 10));

            await createActivityLog({
                userId: user.id,
                type: 'post_created',
                title: 'Second Activity',
                description: 'Second activity'
            });

            const activities = await getUserActivity(user.id);

            expect(activities).toHaveLength(2);
            expect(activities[0].title).toBe('Second Activity'); // Most recent first
            expect(activities[1].title).toBe('First Activity');
            expect(activities[0].timestamp >= activities[1].timestamp).toBe(true);
        });

        it('should use default pagination values for user activities', async () => {
            const user = await createTestUser();

            // Create more than 20 activities (default limit)
            for (let i = 1; i <= 25; i++) {
                await createActivityLog({
                    userId: user.id,
                    type: 'case_created',
                    title: `User Activity ${i}`,
                    description: `User description ${i}`
                });
            }

            const activities = await getUserActivity(user.id);

            // Should return default limit of 20
            expect(activities).toHaveLength(20);
        });
    });
});