import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
    usersTable,
    forumCategoriesTable,
    forumPostsTable,
    forumPostTagsTable,
    forumCommentsTable,
    userPostVotesTable,
    userBookmarksTable
} from '../db/schema';
import { 
    type ForumPostsQueryInput
} from '../schema';
import {
    getForumCategories,
    createForumCategory,
    getForumPosts,
    getForumPostById,
    createForumPost,
    updateForumPost,
    deleteForumPost,
    getForumComments,
    createForumComment,
    voteOnPost,
    toggleBookmark,
    getUserBookmarks
} from '../handlers/forum';
import { eq, and } from 'drizzle-orm';

describe('Forum Handlers', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    // Helper function to create test data
    async function createTestData() {
        // Create users
        const user1 = await db.insert(usersTable)
            .values({
                name: 'Test User 1',
                email: 'user1@test.com',
                password: 'password123',
                professionalType: 'clinician'
            })
            .returning()
            .execute();

        const user2 = await db.insert(usersTable)
            .values({
                name: 'Test User 2',
                email: 'user2@test.com',
                password: 'password123',
                professionalType: 'lab_technician'
            })
            .returning()
            .execute();

        // Create categories
        const category1 = await db.insert(forumCategoriesTable)
            .values({
                name: 'General Discussion',
                description: 'General topics and discussions'
            })
            .returning()
            .execute();

        const category2 = await db.insert(forumCategoriesTable)
            .values({
                name: 'Technical',
                description: 'Technical discussions'
            })
            .returning()
            .execute();

        return {
            users: [user1[0], user2[0]],
            categories: [category1[0], category2[0]]
        };
    }

    describe('Forum Categories', () => {
        it('should create a forum category', async () => {
            const result = await createForumCategory({
                name: 'Test Category',
                description: 'Test description'
            });

            expect(result.name).toEqual('Test Category');
            expect(result.description).toEqual('Test description');
            expect(result.id).toBeDefined();
        });

        it('should create category with null description', async () => {
            const result = await createForumCategory({
                name: 'No Description Category'
            });

            expect(result.name).toEqual('No Description Category');
            expect(result.description).toBeNull();
        });

        it('should get all categories', async () => {
            await createForumCategory({ name: 'Category 1' });
            await createForumCategory({ name: 'Category 2' });

            const results = await getForumCategories();
            expect(results).toHaveLength(2);
            expect(results.map(c => c.name)).toContain('Category 1');
            expect(results.map(c => c.name)).toContain('Category 2');
        });
    });

    describe('Forum Posts', () => {
        it('should create a forum post', async () => {
            const testData = await createTestData();
            
            const result = await createForumPost({
                title: 'Test Post',
                content: 'This is a test post content',
                categoryId: testData.categories[0].id,
                tags: ['test', 'discussion']
            }, testData.users[0].id);

            expect(result.title).toEqual('Test Post');
            expect(result.content).toEqual('This is a test post content');
            expect(result.authorId).toEqual(testData.users[0].id);
            expect(result.categoryId).toEqual(testData.categories[0].id);
            expect(result.upvotes).toEqual(0);
            expect(result.downvotes).toEqual(0);

            // Check tags were created
            const tags = await db.select()
                .from(forumPostTagsTable)
                .where(eq(forumPostTagsTable.postId, result.id))
                .execute();
            
            expect(tags).toHaveLength(2);
            expect(tags.map(t => t.tag).sort()).toEqual(['discussion', 'test']);
        });

        it('should generate excerpt automatically', async () => {
            const testData = await createTestData();
            
            const longContent = 'This is a very long content that should be truncated when generating an automatic excerpt because it exceeds the maximum length limit set for excerpts in the system and needs to be shortened.';
            
            const result = await createForumPost({
                title: 'Auto Excerpt Post',
                content: longContent,
                categoryId: testData.categories[0].id
            }, testData.users[0].id);

            expect(result.excerpt).toBeDefined();
            expect(result.excerpt!.length).toBeLessThanOrEqual(153); // 150 + '...'
            expect(result.excerpt!.endsWith('...')).toBe(true);
        });

        it('should fail to create post with invalid category', async () => {
            const testData = await createTestData();

            await expect(createForumPost({
                title: 'Invalid Category Post',
                content: 'Content',
                categoryId: 999
            }, testData.users[0].id)).rejects.toThrow(/category does not exist/i);
        });

        it('should get post by id and increment view count', async () => {
            const testData = await createTestData();
            
            const post = await createForumPost({
                title: 'View Test Post',
                content: 'Content',
                categoryId: testData.categories[0].id
            }, testData.users[0].id);

            const result = await getForumPostById(post.id);
            expect(result).toBeDefined();
            expect(result!.id).toEqual(post.id);
            expect(result!.viewCount).toEqual(1);

            // Get again to verify increment
            const result2 = await getForumPostById(post.id);
            expect(result2!.viewCount).toEqual(2);
        });

        it('should return null for non-existent post', async () => {
            const result = await getForumPostById(999);
            expect(result).toBeNull();
        });

        it('should get posts with basic filtering', async () => {
            const testData = await createTestData();
            
            // Create posts in different categories
            const post1 = await createForumPost({
                title: 'Category 1 Post',
                content: 'Content 1',
                categoryId: testData.categories[0].id
            }, testData.users[0].id);

            const post2 = await createForumPost({
                title: 'Category 2 Post',
                content: 'Content 2',
                categoryId: testData.categories[1].id
            }, testData.users[1].id);

            // Test category filter
            const categoryResults = await getForumPosts({ categoryId: testData.categories[0].id });
            expect(categoryResults).toHaveLength(1);
            expect(categoryResults[0].id).toEqual(post1.id);

            // Test author filter
            const authorResults = await getForumPosts({ authorId: testData.users[1].id });
            expect(authorResults).toHaveLength(1);
            expect(authorResults[0].id).toEqual(post2.id);
        });

        it('should update forum post', async () => {
            const testData = await createTestData();
            
            const post = await createForumPost({
                title: 'Original Title',
                content: 'Original content',
                categoryId: testData.categories[0].id
            }, testData.users[0].id);

            const result = await updateForumPost({
                id: post.id,
                title: 'Updated Title',
                content: 'Updated content'
            }, testData.users[0].id);

            expect(result).toBeDefined();
            expect(result!.title).toEqual('Updated Title');
            expect(result!.content).toEqual('Updated content');
        });

        it('should not update post by non-author', async () => {
            const testData = await createTestData();
            
            const post = await createForumPost({
                title: 'Original Title',
                content: 'Original content',
                categoryId: testData.categories[0].id
            }, testData.users[0].id);

            await expect(updateForumPost({
                id: post.id,
                title: 'Unauthorized Update'
            }, testData.users[1].id)).rejects.toThrow(/only the author can update/i);
        });

        it('should delete forum post', async () => {
            const testData = await createTestData();
            
            const post = await createForumPost({
                title: 'To Delete',
                content: 'Content',
                categoryId: testData.categories[0].id
            }, testData.users[0].id);

            const result = await deleteForumPost(post.id, testData.users[0].id);
            expect(result).toBe(true);

            // Verify deletion
            const deletedPost = await getForumPostById(post.id);
            expect(deletedPost).toBeNull();
        });

        it('should not delete post by non-author', async () => {
            const testData = await createTestData();
            
            const post = await createForumPost({
                title: 'Protected Post',
                content: 'Content',
                categoryId: testData.categories[0].id
            }, testData.users[0].id);

            await expect(deleteForumPost(post.id, testData.users[1].id)).rejects.toThrow(/only the author can delete/i);
        });
    });

    describe('Forum Comments', () => {
        it('should create a comment', async () => {
            const testData = await createTestData();
            
            const post = await createForumPost({
                title: 'Post for Comments',
                content: 'Content',
                categoryId: testData.categories[0].id
            }, testData.users[0].id);

            const comment = await createForumComment({
                postId: post.id,
                content: 'Test comment'
            }, testData.users[1].id);

            expect(comment.postId).toEqual(post.id);
            expect(comment.authorId).toEqual(testData.users[1].id);
            expect(comment.content).toEqual('Test comment');

            // Verify comment count increased
            const updatedPost = await getForumPostById(post.id);
            expect(updatedPost!.commentCount).toEqual(1);
        });

        it('should get comments for a post', async () => {
            const testData = await createTestData();
            
            const post = await createForumPost({
                title: 'Post with Comments',
                content: 'Content',
                categoryId: testData.categories[0].id
            }, testData.users[0].id);

            await createForumComment({
                postId: post.id,
                content: 'First comment'
            }, testData.users[0].id);

            await createForumComment({
                postId: post.id,
                content: 'Second comment'
            }, testData.users[1].id);

            const comments = await getForumComments(post.id);
            expect(comments).toHaveLength(2);
            expect(comments[0].content).toEqual('First comment');
            expect(comments[1].content).toEqual('Second comment');
        });
    });

    describe('Voting', () => {
        it('should vote on a post', async () => {
            const testData = await createTestData();
            
            const post = await createForumPost({
                title: 'Post to Vote On',
                content: 'Content',
                categoryId: testData.categories[0].id
            }, testData.users[0].id);

            // Upvote
            const result = await voteOnPost({
                postId: post.id,
                voteType: 'up'
            }, testData.users[1].id);

            expect(result).toBe(true);

            // Check vote counts
            const updatedPost = await getForumPostById(post.id);
            expect(updatedPost!.upvotes).toEqual(1);
            expect(updatedPost!.downvotes).toEqual(0);
        });

        it('should toggle vote when voting same type twice', async () => {
            const testData = await createTestData();
            
            const post = await createForumPost({
                title: 'Toggle Vote Post',
                content: 'Content',
                categoryId: testData.categories[0].id
            }, testData.users[0].id);

            // First upvote
            await voteOnPost({
                postId: post.id,
                voteType: 'up'
            }, testData.users[1].id);

            // Second upvote (should remove)
            await voteOnPost({
                postId: post.id,
                voteType: 'up'
            }, testData.users[1].id);

            const updatedPost = await getForumPostById(post.id);
            expect(updatedPost!.upvotes).toEqual(0);
            expect(updatedPost!.downvotes).toEqual(0);
        });
    });

    describe('Bookmarks', () => {
        it('should toggle bookmark', async () => {
            const testData = await createTestData();
            
            const post = await createForumPost({
                title: 'Bookmark Test',
                content: 'Content',
                categoryId: testData.categories[0].id
            }, testData.users[0].id);

            // Add bookmark
            const result1 = await toggleBookmark({
                postId: post.id
            }, testData.users[1].id);

            expect(result1).toBe(true);

            // Verify bookmark exists
            const bookmarks = await db.select()
                .from(userBookmarksTable)
                .where(and(
                    eq(userBookmarksTable.userId, testData.users[1].id),
                    eq(userBookmarksTable.postId, post.id)
                ))
                .execute();

            expect(bookmarks).toHaveLength(1);

            // Remove bookmark
            await toggleBookmark({
                postId: post.id
            }, testData.users[1].id);

            // Verify bookmark removed
            const bookmarksAfter = await db.select()
                .from(userBookmarksTable)
                .where(and(
                    eq(userBookmarksTable.userId, testData.users[1].id),
                    eq(userBookmarksTable.postId, post.id)
                ))
                .execute();

            expect(bookmarksAfter).toHaveLength(0);
        });

        it('should get user bookmarks', async () => {
            const testData = await createTestData();
            
            const post1 = await createForumPost({
                title: 'Bookmarked Post 1',
                content: 'Content 1',
                categoryId: testData.categories[0].id
            }, testData.users[0].id);

            const post2 = await createForumPost({
                title: 'Bookmarked Post 2',
                content: 'Content 2',
                categoryId: testData.categories[0].id
            }, testData.users[0].id);

            // Bookmark posts
            await toggleBookmark({ postId: post1.id }, testData.users[1].id);
            await toggleBookmark({ postId: post2.id }, testData.users[1].id);

            const bookmarks = await getUserBookmarks(testData.users[1].id);
            expect(bookmarks).toHaveLength(2);
            
            const bookmarkTitles = bookmarks.map(b => b.title);
            expect(bookmarkTitles).toContain('Bookmarked Post 1');
            expect(bookmarkTitles).toContain('Bookmarked Post 2');
        });
    });
});