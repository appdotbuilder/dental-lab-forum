import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, notificationsTable } from '../db/schema';
import { 
    getUserNotifications, 
    createNotification, 
    markNotificationRead, 
    markAllNotificationsRead,
    getUnreadNotificationCount 
} from '../handlers/notifications';
import { 
    type CreateNotificationInput,
    type MarkNotificationReadInput
} from '../schema';
import { eq, and } from 'drizzle-orm';

describe('notifications handlers', () => {
    let testUserId: number;
    let testUserId2: number;

    beforeEach(async () => {
        await createDB();
        
        // Create test users
        const users = await db.insert(usersTable)
            .values([
                {
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'hashedpassword123',
                    professionalType: 'clinician'
                },
                {
                    name: 'Test User 2',
                    email: 'test2@example.com',
                    password: 'hashedpassword123',
                    professionalType: 'lab_technician'
                }
            ])
            .returning({ id: usersTable.id })
            .execute();

        testUserId = users[0].id;
        testUserId2 = users[1].id;
    });

    afterEach(resetDB);

    describe('createNotification', () => {
        it('should create a notification', async () => {
            const input: CreateNotificationInput = {
                userId: testUserId,
                type: 'case_update',
                message: 'Your case has been updated',
                metadata: JSON.stringify({ caseId: 123 })
            };

            const result = await createNotification(input);

            expect(result.userId).toBe(testUserId);
            expect(result.type).toBe('case_update');
            expect(result.message).toBe('Your case has been updated');
            expect(result.metadata).toBe('{"caseId":123}');
            expect(result.isRead).toBe(false);
            expect(result.id).toBeDefined();
            expect(result.createdAt).toBeInstanceOf(Date);
        });

        it('should create a notification without metadata', async () => {
            const input: CreateNotificationInput = {
                userId: testUserId,
                type: 'comment',
                message: 'New comment on your post'
            };

            const result = await createNotification(input);

            expect(result.userId).toBe(testUserId);
            expect(result.type).toBe('comment');
            expect(result.message).toBe('New comment on your post');
            expect(result.metadata).toBeNull();
            expect(result.isRead).toBe(false);
            expect(result.id).toBeDefined();
            expect(result.createdAt).toBeInstanceOf(Date);
        });

        it('should save notification to database', async () => {
            const input: CreateNotificationInput = {
                userId: testUserId,
                type: 'mention',
                message: 'You were mentioned in a discussion'
            };

            const result = await createNotification(input);

            const notifications = await db.select()
                .from(notificationsTable)
                .where(eq(notificationsTable.id, result.id))
                .execute();

            expect(notifications).toHaveLength(1);
            expect(notifications[0].userId).toBe(testUserId);
            expect(notifications[0].type).toBe('mention');
            expect(notifications[0].message).toBe('You were mentioned in a discussion');
            expect(notifications[0].isRead).toBe(false);
        });
    });

    describe('getUserNotifications', () => {
        beforeEach(async () => {
            // Create test notifications for user 1 with slight delays to ensure proper ordering
            const notification1 = await db.insert(notificationsTable)
                .values({
                    userId: testUserId,
                    type: 'case_update',
                    message: 'First notification',
                    isRead: false
                })
                .execute();

            // Small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 1));

            const notification2 = await db.insert(notificationsTable)
                .values({
                    userId: testUserId,
                    type: 'comment',
                    message: 'Second notification',
                    isRead: true
                })
                .execute();

            await new Promise(resolve => setTimeout(resolve, 1));

            const notification3 = await db.insert(notificationsTable)
                .values({
                    userId: testUserId,
                    type: 'mention',
                    message: 'Third notification',
                    isRead: false
                })
                .execute();

            // Create notification for different user
            await db.insert(notificationsTable)
                .values({
                    userId: testUserId2,
                    type: 'vote',
                    message: 'Notification for user 2',
                    isRead: false
                })
                .execute();
        });

        it('should get all notifications for a user', async () => {
            const result = await getUserNotifications(testUserId);

            expect(result).toHaveLength(3);
            
            // Check that all notifications belong to the correct user
            result.forEach(notification => {
                expect(notification.userId).toBe(testUserId);
                expect(notification.createdAt).toBeInstanceOf(Date);
            });

            // Should be ordered by newest first
            expect(result[0].message).toBe('Third notification');
            expect(result[1].message).toBe('Second notification');
            expect(result[2].message).toBe('First notification');
        });

        it('should filter unread notifications only', async () => {
            const result = await getUserNotifications(testUserId, { unreadOnly: true });

            expect(result).toHaveLength(2);
            result.forEach(notification => {
                expect(notification.isRead).toBe(false);
                expect(notification.userId).toBe(testUserId);
            });
        });

        it('should handle pagination', async () => {
            const result = await getUserNotifications(testUserId, { 
                page: 1, 
                limit: 2 
            });

            expect(result).toHaveLength(2);
            expect(result[0].message).toBe('Third notification');
            expect(result[1].message).toBe('Second notification');
        });

        it('should handle pagination with offset', async () => {
            const result = await getUserNotifications(testUserId, { 
                page: 2, 
                limit: 2 
            });

            expect(result).toHaveLength(1);
            expect(result[0].message).toBe('First notification');
        });

        it('should return empty array for user with no notifications', async () => {
            // Create a new user with no notifications
            const newUser = await db.insert(usersTable)
                .values({
                    name: 'New User',
                    email: 'new@example.com',
                    password: 'hashedpassword123',
                    professionalType: 'student'
                })
                .returning({ id: usersTable.id })
                .execute();

            const result = await getUserNotifications(newUser[0].id);
            expect(result).toHaveLength(0);
        });
    });

    describe('markNotificationRead', () => {
        let notificationId: number;

        beforeEach(async () => {
            const notifications = await db.insert(notificationsTable)
                .values([
                    {
                        userId: testUserId,
                        type: 'case_update',
                        message: 'Unread notification',
                        isRead: false
                    },
                    {
                        userId: testUserId2,
                        type: 'comment',
                        message: 'Other user notification',
                        isRead: false
                    }
                ])
                .returning({ id: notificationsTable.id })
                .execute();

            notificationId = notifications[0].id;
        });

        it('should mark notification as read', async () => {
            const input: MarkNotificationReadInput = {
                notificationId
            };

            const result = await markNotificationRead(input, testUserId);
            expect(result).toBe(true);

            // Verify in database
            const notification = await db.select()
                .from(notificationsTable)
                .where(eq(notificationsTable.id, notificationId))
                .execute();

            expect(notification[0].isRead).toBe(true);
        });

        it('should return false for non-existent notification', async () => {
            const input: MarkNotificationReadInput = {
                notificationId: 99999
            };

            const result = await markNotificationRead(input, testUserId);
            expect(result).toBe(false);
        });

        it('should return false for notification belonging to different user', async () => {
            const input: MarkNotificationReadInput = {
                notificationId
            };

            // Try to mark with wrong user ID
            const result = await markNotificationRead(input, testUserId2);
            expect(result).toBe(false);

            // Verify notification is still unread
            const notification = await db.select()
                .from(notificationsTable)
                .where(eq(notificationsTable.id, notificationId))
                .execute();

            expect(notification[0].isRead).toBe(false);
        });
    });

    describe('markAllNotificationsRead', () => {
        beforeEach(async () => {
            // Create mix of read and unread notifications
            await db.insert(notificationsTable)
                .values([
                    {
                        userId: testUserId,
                        type: 'case_update',
                        message: 'Unread 1',
                        isRead: false
                    },
                    {
                        userId: testUserId,
                        type: 'comment',
                        message: 'Already read',
                        isRead: true
                    },
                    {
                        userId: testUserId,
                        type: 'mention',
                        message: 'Unread 2',
                        isRead: false
                    },
                    {
                        userId: testUserId2,
                        type: 'vote',
                        message: 'Other user unread',
                        isRead: false
                    }
                ])
                .execute();
        });

        it('should mark all user notifications as read', async () => {
            const result = await markAllNotificationsRead(testUserId);
            expect(result).toBe(true);

            // Verify all user notifications are now read
            const notifications = await db.select()
                .from(notificationsTable)
                .where(eq(notificationsTable.userId, testUserId))
                .execute();

            notifications.forEach(notification => {
                expect(notification.isRead).toBe(true);
            });

            // Verify other user's notifications are unchanged
            const otherUserNotifications = await db.select()
                .from(notificationsTable)
                .where(eq(notificationsTable.userId, testUserId2))
                .execute();

            expect(otherUserNotifications[0].isRead).toBe(false);
        });

        it('should work for user with no unread notifications', async () => {
            // Mark all as read first
            await markAllNotificationsRead(testUserId);

            // Try again - should still return true
            const result = await markAllNotificationsRead(testUserId);
            expect(result).toBe(true);
        });
    });

    describe('getUnreadNotificationCount', () => {
        beforeEach(async () => {
            await db.insert(notificationsTable)
                .values([
                    {
                        userId: testUserId,
                        type: 'case_update',
                        message: 'Unread 1',
                        isRead: false
                    },
                    {
                        userId: testUserId,
                        type: 'comment',
                        message: 'Read notification',
                        isRead: true
                    },
                    {
                        userId: testUserId,
                        type: 'mention',
                        message: 'Unread 2',
                        isRead: false
                    },
                    {
                        userId: testUserId,
                        type: 'vote',
                        message: 'Unread 3',
                        isRead: false
                    },
                    {
                        userId: testUserId2,
                        type: 'collaboration_invite',
                        message: 'Other user unread',
                        isRead: false
                    }
                ])
                .execute();
        });

        it('should return correct unread count', async () => {
            const count = await getUnreadNotificationCount(testUserId);
            expect(count).toBe(3);
        });

        it('should return zero for user with no unread notifications', async () => {
            // Mark all as read
            await markAllNotificationsRead(testUserId);

            const count = await getUnreadNotificationCount(testUserId);
            expect(count).toBe(0);
        });

        it('should return zero for user with no notifications', async () => {
            const newUser = await db.insert(usersTable)
                .values({
                    name: 'New User',
                    email: 'new@example.com',
                    password: 'hashedpassword123',
                    professionalType: 'educator'
                })
                .returning({ id: usersTable.id })
                .execute();

            const count = await getUnreadNotificationCount(newUser[0].id);
            expect(count).toBe(0);
        });
    });

    describe('edge cases and data integrity', () => {
        it('should handle notifications with all notification types', async () => {
            const notificationTypes = ['case_update', 'comment', 'mention', 'collaboration_invite', 'vote'] as const;
            
            for (const type of notificationTypes) {
                const input: CreateNotificationInput = {
                    userId: testUserId,
                    type,
                    message: `Test ${type} notification`
                };

                const result = await createNotification(input);
                expect(result.type).toBe(type);
                expect(result.userId).toBe(testUserId);
            }

            const notifications = await getUserNotifications(testUserId);
            expect(notifications).toHaveLength(5);
        });

        it('should handle large pagination offsets gracefully', async () => {
            // Create only a few notifications
            await createNotification({
                userId: testUserId,
                type: 'case_update',
                message: 'Test notification'
            });

            // Request page far beyond available data
            const result = await getUserNotifications(testUserId, {
                page: 10,
                limit: 20
            });

            expect(result).toHaveLength(0);
        });

        it('should preserve metadata format', async () => {
            const complexMetadata = {
                caseId: 123,
                actionType: 'update',
                changes: ['title', 'description'],
                timestamp: new Date().toISOString()
            };

            const input: CreateNotificationInput = {
                userId: testUserId,
                type: 'case_update',
                message: 'Complex metadata test',
                metadata: JSON.stringify(complexMetadata)
            };

            const result = await createNotification(input);
            expect(result.metadata).toBe(JSON.stringify(complexMetadata));
            
            // Parse back to verify structure
            const parsed = JSON.parse(result.metadata!);
            expect(parsed.caseId).toBe(123);
            expect(parsed.actionType).toBe('update');
            expect(parsed.changes).toEqual(['title', 'description']);
        });
    });
});