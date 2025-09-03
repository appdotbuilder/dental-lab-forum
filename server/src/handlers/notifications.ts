import { db } from '../db';
import { notificationsTable } from '../db/schema';
import { 
    type Notification,
    type CreateNotificationInput,
    type MarkNotificationReadInput 
} from '../schema';
import { eq, and, desc, count } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

/**
 * Get notifications for a user
 * This handler should fetch all notifications for the authenticated user
 * with pagination and filtering by read/unread status
 */
export async function getUserNotifications(userId: number, filters?: { 
    unreadOnly?: boolean; 
    page?: number; 
    limit?: number; 
}): Promise<Notification[]> {
    try {
        // Set default pagination values
        const page = filters?.page || 1;
        const limit = filters?.limit || 20;
        const offset = (page - 1) * limit;

        // Build conditions array
        const conditions: SQL<unknown>[] = [
            eq(notificationsTable.userId, userId)
        ];

        // Add unread filter if specified
        if (filters?.unreadOnly) {
            conditions.push(eq(notificationsTable.isRead, false));
        }

        // Build complete query in one go to avoid type issues
        const results = await db.select()
            .from(notificationsTable)
            .where(and(...conditions))
            .orderBy(desc(notificationsTable.createdAt))
            .limit(limit)
            .offset(offset)
            .execute();

        return results.map(notification => ({
            ...notification,
            createdAt: new Date(notification.createdAt)
        }));
    } catch (error) {
        console.error('Failed to get user notifications:', error);
        throw error;
    }
}

/**
 * Create a notification for a user
 * This handler should create notifications for various system events
 * (case updates, comments, mentions, collaboration invites, etc.)
 */
export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
    try {
        const result = await db.insert(notificationsTable)
            .values({
                userId: input.userId,
                type: input.type,
                message: input.message,
                metadata: input.metadata || null,
                isRead: false
            })
            .returning()
            .execute();

        const notification = result[0];
        return {
            ...notification,
            createdAt: new Date(notification.createdAt)
        };
    } catch (error) {
        console.error('Failed to create notification:', error);
        throw error;
    }
}

/**
 * Mark notification as read
 * This handler should update the read status of a notification
 */
export async function markNotificationRead(input: MarkNotificationReadInput, userId: number): Promise<boolean> {
    try {
        const result = await db.update(notificationsTable)
            .set({ isRead: true })
            .where(and(
                eq(notificationsTable.id, input.notificationId),
                eq(notificationsTable.userId, userId)
            ))
            .returning({ id: notificationsTable.id })
            .execute();

        return result.length > 0;
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
        throw error;
    }
}

/**
 * Mark all notifications as read for a user
 * This handler should mark all unread notifications as read
 */
export async function markAllNotificationsRead(userId: number): Promise<boolean> {
    try {
        await db.update(notificationsTable)
            .set({ isRead: true })
            .where(and(
                eq(notificationsTable.userId, userId),
                eq(notificationsTable.isRead, false)
            ))
            .execute();

        return true;
    } catch (error) {
        console.error('Failed to mark all notifications as read:', error);
        throw error;
    }
}

/**
 * Get unread notification count
 * This handler should return the count of unread notifications for a user
 */
export async function getUnreadNotificationCount(userId: number): Promise<number> {
    try {
        const result = await db.select({ count: count() })
            .from(notificationsTable)
            .where(and(
                eq(notificationsTable.userId, userId),
                eq(notificationsTable.isRead, false)
            ))
            .execute();

        return result[0]?.count || 0;
    } catch (error) {
        console.error('Failed to get unread notification count:', error);
        throw error;
    }
}