import { db } from '../db';
import { 
    usersTable,
    casesTable,
    forumPostsTable,
    forumCommentsTable,
    userPostVotesTable,
    activityLogsTable
} from '../db/schema';
import { 
    type DashboardStats,
    type ActivityLog,
    type CreateActivityLogInput 
} from '../schema';
import { count, eq, gte, desc, and, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

/**
 * Get dashboard statistics
 * This handler calculates and returns key platform metrics
 * including total cases, active cases, forum posts, active users, and engagement
 */
export async function getDashboardStats(): Promise<DashboardStats> {
    try {
        // Calculate 30 days ago for "active" metrics
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Get total cases count
        const totalCasesResult = await db.select({ count: count() })
            .from(casesTable)
            .execute();

        // Get active cases (cases that are not draft, completed, or cancelled)
        const activeCasesResult = await db.select({ count: count() })
            .from(casesTable)
            .where(and(
                eq(casesTable.status, 'active'),
                gte(casesTable.updatedAt, thirtyDaysAgo)
            ))
            .execute();

        // Get total forum posts
        const totalPostsResult = await db.select({ count: count() })
            .from(forumPostsTable)
            .execute();

        // Get active users (users who have activity in the last 30 days)
        const activeUsersResult = await db.select({ count: count() })
            .from(usersTable)
            .where(gte(usersTable.updatedAt, thirtyDaysAgo))
            .execute();

        // Calculate total engagement (votes + comments)
        const votesResult = await db.select({ count: count() })
            .from(userPostVotesTable)
            .execute();

        const commentsResult = await db.select({ count: count() })
            .from(forumCommentsTable)
            .execute();

        const totalEngagement = votesResult[0].count + commentsResult[0].count;

        return {
            totalCases: totalCasesResult[0].count,
            activeCases: activeCasesResult[0].count,
            totalPosts: totalPostsResult[0].count,
            activeUsers: activeUsersResult[0].count,
            totalEngagement: totalEngagement
        };
    } catch (error) {
        console.error('Failed to get dashboard stats:', error);
        throw error;
    }
}

/**
 * Get recent activity feed
 * This handler fetches recent platform activities with pagination
 * showing case creations, post creations, comments, file uploads, etc.
 */
export async function getActivityFeed(filters?: { 
    userId?: number; 
    page?: number; 
    limit?: number; 
}): Promise<ActivityLog[]> {
    try {
        // Apply defaults
        const page = filters?.page || 1;
        const limit = filters?.limit || 20;
        const offset = (page - 1) * limit;

        // Build base query
        const baseQuery = db.select().from(activityLogsTable);

        // Build conditions array
        const conditions: SQL<unknown>[] = [];

        // Filter by user if specified
        if (filters?.userId !== undefined) {
            conditions.push(eq(activityLogsTable.userId, filters.userId));
        }

        // Build final query with conditions
        const finalQuery = conditions.length > 0 
            ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
            : baseQuery;

        // Execute with ordering and pagination
        const results = await finalQuery
            .orderBy(desc(activityLogsTable.timestamp))
            .limit(limit)
            .offset(offset)
            .execute();

        return results.map(activity => ({
            ...activity,
            timestamp: activity.timestamp
        }));
    } catch (error) {
        console.error('Failed to get activity feed:', error);
        throw error;
    }
}

/**
 * Create activity log entry
 * This handler logs user activities for the activity feed
 */
export async function createActivityLog(input: CreateActivityLogInput): Promise<ActivityLog> {
    try {
        // Insert activity log record
        const result = await db.insert(activityLogsTable)
            .values({
                userId: input.userId,
                type: input.type,
                title: input.title,
                description: input.description,
                metadata: input.metadata || null
            })
            .returning()
            .execute();

        const activity = result[0];
        return {
            ...activity,
            timestamp: activity.timestamp
        };
    } catch (error) {
        console.error('Activity log creation failed:', error);
        throw error;
    }
}

/**
 * Get user's personal activity history
 * This handler fetches activities specific to a user
 */
export async function getUserActivity(userId: number, filters?: { 
    page?: number; 
    limit?: number; 
}): Promise<ActivityLog[]> {
    try {
        // Apply defaults
        const page = filters?.page || 1;
        const limit = filters?.limit || 20;
        const offset = (page - 1) * limit;

        // Query user's activities
        const results = await db.select()
            .from(activityLogsTable)
            .where(eq(activityLogsTable.userId, userId))
            .orderBy(desc(activityLogsTable.timestamp))
            .limit(limit)
            .offset(offset)
            .execute();

        return results.map(activity => ({
            ...activity,
            timestamp: activity.timestamp
        }));
    } catch (error) {
        console.error('Failed to get user activity:', error);
        throw error;
    }
}