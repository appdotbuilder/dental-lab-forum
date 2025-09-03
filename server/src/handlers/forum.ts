import { db } from '../db';
import { 
    forumCategoriesTable,
    forumPostsTable,
    forumPostTagsTable,
    forumCommentsTable,
    userPostVotesTable,
    userBookmarksTable,
    usersTable
} from '../db/schema';
import { 
    type ForumCategory, 
    type CreateForumCategoryInput,
    type ForumPost,
    type CreateForumPostInput,
    type UpdateForumPostInput,
    type ForumComment,
    type CreateForumCommentInput,
    type VotePostInput,
    type BookmarkPostInput,
    type ForumPostsQueryInput 
} from '../schema';
import { eq, desc, asc, and, sql, inArray } from 'drizzle-orm';

// Helper function to generate excerpt from content
function generateExcerpt(content: string, maxLength = 150): string {
    const plainText = content.replace(/<[^>]*>/g, '').trim();
    if (plainText.length <= maxLength) return plainText;
    return plainText.substring(0, maxLength).trim() + '...';
}

// Forum Categories
export async function getForumCategories(): Promise<ForumCategory[]> {
    try {
        const results = await db.select()
            .from(forumCategoriesTable)
            .execute();
        
        return results;
    } catch (error) {
        console.error('Failed to fetch forum categories:', error);
        throw error;
    }
}

export async function createForumCategory(input: CreateForumCategoryInput): Promise<ForumCategory> {
    try {
        const result = await db.insert(forumCategoriesTable)
            .values({
                name: input.name,
                description: input.description || null
            })
            .returning()
            .execute();

        return result[0];
    } catch (error) {
        console.error('Failed to create forum category:', error);
        throw error;
    }
}

// Forum Posts
export async function getForumPosts(query: ForumPostsQueryInput, userId?: number): Promise<ForumPost[]> {
    try {
        // Set defaults for pagination
        const page = query.page || 1;
        const limit = query.limit || 10;
        const offset = (page - 1) * limit;

        // Handle tag filtering with a simpler approach
        if (query.tag) {
            // Get post IDs that have the specific tag
            const taggedPosts = await db.select({ postId: forumPostTagsTable.postId })
                .from(forumPostTagsTable)
                .where(eq(forumPostTagsTable.tag, query.tag))
                .execute();

            if (taggedPosts.length === 0) {
                return [];
            }

            const postIds = taggedPosts.map(tp => tp.postId);
            
            // Build query with all conditions at once
            let whereConditions = [inArray(forumPostsTable.id, postIds)];
            
            if (query.categoryId !== undefined) {
                whereConditions.push(eq(forumPostsTable.categoryId, query.categoryId));
            }
            if (query.authorId !== undefined) {
                whereConditions.push(eq(forumPostsTable.authorId, query.authorId));
            }

            // Build the complete query in one go
            return await db.select()
                .from(forumPostsTable)
                .where(and(...whereConditions))
                .orderBy(
                    query.sortBy === 'oldest' ? asc(forumPostsTable.createdAt) :
                    query.sortBy === 'mostVoted' ? desc(sql`${forumPostsTable.upvotes} - ${forumPostsTable.downvotes}`) :
                    query.sortBy === 'mostCommented' ? desc(forumPostsTable.commentCount) :
                    desc(forumPostsTable.createdAt)
                )
                .limit(limit)
                .offset(offset)
                .execute();
        } else {
            // For non-tag queries, build complete query
            const whereConditions = [];
            if (query.categoryId !== undefined) {
                whereConditions.push(eq(forumPostsTable.categoryId, query.categoryId));
            }
            if (query.authorId !== undefined) {
                whereConditions.push(eq(forumPostsTable.authorId, query.authorId));
            }

            // Build complete query based on whether we have conditions
            if (whereConditions.length > 0) {
                return await db.select()
                    .from(forumPostsTable)
                    .where(and(...whereConditions))
                    .orderBy(
                        query.sortBy === 'oldest' ? asc(forumPostsTable.createdAt) :
                        query.sortBy === 'mostVoted' ? desc(sql`${forumPostsTable.upvotes} - ${forumPostsTable.downvotes}`) :
                        query.sortBy === 'mostCommented' ? desc(forumPostsTable.commentCount) :
                        desc(forumPostsTable.createdAt)
                    )
                    .limit(limit)
                    .offset(offset)
                    .execute();
            } else {
                return await db.select()
                    .from(forumPostsTable)
                    .orderBy(
                        query.sortBy === 'oldest' ? asc(forumPostsTable.createdAt) :
                        query.sortBy === 'mostVoted' ? desc(sql`${forumPostsTable.upvotes} - ${forumPostsTable.downvotes}`) :
                        query.sortBy === 'mostCommented' ? desc(forumPostsTable.commentCount) :
                        desc(forumPostsTable.createdAt)
                    )
                    .limit(limit)
                    .offset(offset)
                    .execute();
            }
        }
    } catch (error) {
        console.error('Failed to fetch forum posts:', error);
        throw error;
    }
}

export async function getForumPostById(postId: number, userId?: number): Promise<ForumPost | null> {
    try {
        // First increment view count
        await db.update(forumPostsTable)
            .set({
                viewCount: sql`${forumPostsTable.viewCount} + 1`
            })
            .where(eq(forumPostsTable.id, postId))
            .execute();

        // Then fetch the post
        const results = await db.select()
            .from(forumPostsTable)
            .where(eq(forumPostsTable.id, postId))
            .execute();

        return results.length > 0 ? results[0] : null;
    } catch (error) {
        console.error('Failed to fetch forum post:', error);
        throw error;
    }
}

export async function createForumPost(input: CreateForumPostInput, authorId: number): Promise<ForumPost> {
    try {
        // Verify category exists
        const categoryExists = await db.select()
            .from(forumCategoriesTable)
            .where(eq(forumCategoriesTable.id, input.categoryId))
            .execute();

        if (categoryExists.length === 0) {
            throw new Error('Forum category does not exist');
        }

        // Generate excerpt if not provided
        const excerpt = input.excerpt || generateExcerpt(input.content);

        // Create the post
        const result = await db.insert(forumPostsTable)
            .values({
                title: input.title,
                content: input.content,
                excerpt: excerpt,
                authorId: authorId,
                categoryId: input.categoryId
            })
            .returning()
            .execute();

        const post = result[0];

        // Add tags if provided
        if (input.tags && input.tags.length > 0) {
            const tagValues = input.tags.map(tag => ({
                postId: post.id,
                tag: tag.trim()
            }));

            await db.insert(forumPostTagsTable)
                .values(tagValues)
                .execute();
        }

        return post;
    } catch (error) {
        console.error('Failed to create forum post:', error);
        throw error;
    }
}

export async function updateForumPost(input: UpdateForumPostInput, userId: number): Promise<ForumPost | null> {
    try {
        // Verify user is the author
        const existingPost = await db.select()
            .from(forumPostsTable)
            .where(eq(forumPostsTable.id, input.id))
            .execute();

        if (existingPost.length === 0) {
            return null;
        }

        if (existingPost[0].authorId !== userId) {
            throw new Error('Only the author can update this post');
        }

        // Verify category exists if categoryId is being updated
        if (input.categoryId !== undefined) {
            const categoryExists = await db.select()
                .from(forumCategoriesTable)
                .where(eq(forumCategoriesTable.id, input.categoryId))
                .execute();

            if (categoryExists.length === 0) {
                throw new Error('Forum category does not exist');
            }
        }

        // Build update object
        const updateData: any = {
            updatedAt: new Date()
        };

        if (input.title !== undefined) updateData.title = input.title;
        if (input.content !== undefined) {
            updateData.content = input.content;
            // Regenerate excerpt if content is updated and no explicit excerpt provided
            if (input.excerpt === undefined) {
                updateData.excerpt = generateExcerpt(input.content);
            }
        }
        if (input.excerpt !== undefined) updateData.excerpt = input.excerpt;
        if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;

        // Update the post
        const result = await db.update(forumPostsTable)
            .set(updateData)
            .where(eq(forumPostsTable.id, input.id))
            .returning()
            .execute();

        // Update tags if provided
        if (input.tags !== undefined) {
            // Remove existing tags
            await db.delete(forumPostTagsTable)
                .where(eq(forumPostTagsTable.postId, input.id))
                .execute();

            // Add new tags
            if (input.tags.length > 0) {
                const tagValues = input.tags.map(tag => ({
                    postId: input.id,
                    tag: tag.trim()
                }));

                await db.insert(forumPostTagsTable)
                    .values(tagValues)
                    .execute();
            }
        }

        return result[0];
    } catch (error) {
        console.error('Failed to update forum post:', error);
        throw error;
    }
}

export async function deleteForumPost(postId: number, userId: number): Promise<boolean> {
    try {
        // Verify user is the author
        const existingPost = await db.select()
            .from(forumPostsTable)
            .where(eq(forumPostsTable.id, postId))
            .execute();

        if (existingPost.length === 0) {
            return false;
        }

        if (existingPost[0].authorId !== userId) {
            throw new Error('Only the author can delete this post');
        }

        // Delete related data (foreign key constraints will handle this, but explicit deletion ensures cleanup)
        await db.delete(forumPostTagsTable)
            .where(eq(forumPostTagsTable.postId, postId))
            .execute();

        await db.delete(forumCommentsTable)
            .where(eq(forumCommentsTable.postId, postId))
            .execute();

        await db.delete(userPostVotesTable)
            .where(eq(userPostVotesTable.postId, postId))
            .execute();

        await db.delete(userBookmarksTable)
            .where(eq(userBookmarksTable.postId, postId))
            .execute();

        // Delete the post
        await db.delete(forumPostsTable)
            .where(eq(forumPostsTable.id, postId))
            .execute();

        return true;
    } catch (error) {
        console.error('Failed to delete forum post:', error);
        throw error;
    }
}

// Forum Comments
export async function getForumComments(postId: number): Promise<ForumComment[]> {
    try {
        const results = await db.select()
            .from(forumCommentsTable)
            .where(eq(forumCommentsTable.postId, postId))
            .orderBy(asc(forumCommentsTable.createdAt))
            .execute();

        return results;
    } catch (error) {
        console.error('Failed to fetch forum comments:', error);
        throw error;
    }
}

export async function createForumComment(input: CreateForumCommentInput, authorId: number): Promise<ForumComment> {
    try {
        // Verify post exists
        const postExists = await db.select()
            .from(forumPostsTable)
            .where(eq(forumPostsTable.id, input.postId))
            .execute();

        if (postExists.length === 0) {
            throw new Error('Forum post does not exist');
        }

        // Create the comment
        const result = await db.insert(forumCommentsTable)
            .values({
                postId: input.postId,
                authorId: authorId,
                content: input.content
            })
            .returning()
            .execute();

        // Increment comment count on the post
        await db.update(forumPostsTable)
            .set({
                commentCount: sql`${forumPostsTable.commentCount} + 1`
            })
            .where(eq(forumPostsTable.id, input.postId))
            .execute();

        return result[0];
    } catch (error) {
        console.error('Failed to create forum comment:', error);
        throw error;
    }
}

// Voting
export async function voteOnPost(input: VotePostInput, userId: number): Promise<boolean> {
    try {
        // Verify post exists
        const postExists = await db.select()
            .from(forumPostsTable)
            .where(eq(forumPostsTable.id, input.postId))
            .execute();

        if (postExists.length === 0) {
            throw new Error('Forum post does not exist');
        }

        // Check if user already voted
        const existingVote = await db.select()
            .from(userPostVotesTable)
            .where(and(
                eq(userPostVotesTable.userId, userId),
                eq(userPostVotesTable.postId, input.postId)
            ))
            .execute();

        if (existingVote.length > 0) {
            const currentVote = existingVote[0];
            
            if (currentVote.voteType === input.voteType) {
                // Same vote type - remove the vote
                await db.delete(userPostVotesTable)
                    .where(and(
                        eq(userPostVotesTable.userId, userId),
                        eq(userPostVotesTable.postId, input.postId)
                    ))
                    .execute();

                // Decrement the appropriate count
                if (input.voteType === 'up') {
                    await db.update(forumPostsTable)
                        .set({ upvotes: sql`${forumPostsTable.upvotes} - 1` })
                        .where(eq(forumPostsTable.id, input.postId))
                        .execute();
                } else {
                    await db.update(forumPostsTable)
                        .set({ downvotes: sql`${forumPostsTable.downvotes} - 1` })
                        .where(eq(forumPostsTable.id, input.postId))
                        .execute();
                }
            } else {
                // Different vote type - update the vote
                await db.update(userPostVotesTable)
                    .set({ voteType: input.voteType })
                    .where(and(
                        eq(userPostVotesTable.userId, userId),
                        eq(userPostVotesTable.postId, input.postId)
                    ))
                    .execute();

                // Update both counts (decrement old, increment new)
                if (input.voteType === 'up') {
                    await db.update(forumPostsTable)
                        .set({
                            upvotes: sql`${forumPostsTable.upvotes} + 1`,
                            downvotes: sql`${forumPostsTable.downvotes} - 1`
                        })
                        .where(eq(forumPostsTable.id, input.postId))
                        .execute();
                } else {
                    await db.update(forumPostsTable)
                        .set({
                            upvotes: sql`${forumPostsTable.upvotes} - 1`,
                            downvotes: sql`${forumPostsTable.downvotes} + 1`
                        })
                        .where(eq(forumPostsTable.id, input.postId))
                        .execute();
                }
            }
        } else {
            // New vote
            await db.insert(userPostVotesTable)
                .values({
                    userId: userId,
                    postId: input.postId,
                    voteType: input.voteType
                })
                .execute();

            // Increment the appropriate count
            if (input.voteType === 'up') {
                await db.update(forumPostsTable)
                    .set({ upvotes: sql`${forumPostsTable.upvotes} + 1` })
                    .where(eq(forumPostsTable.id, input.postId))
                    .execute();
            } else {
                await db.update(forumPostsTable)
                    .set({ downvotes: sql`${forumPostsTable.downvotes} + 1` })
                    .where(eq(forumPostsTable.id, input.postId))
                    .execute();
            }
        }

        return true;
    } catch (error) {
        console.error('Failed to vote on post:', error);
        throw error;
    }
}

// Bookmarks
export async function toggleBookmark(input: BookmarkPostInput, userId: number): Promise<boolean> {
    try {
        // Verify post exists
        const postExists = await db.select()
            .from(forumPostsTable)
            .where(eq(forumPostsTable.id, input.postId))
            .execute();

        if (postExists.length === 0) {
            throw new Error('Forum post does not exist');
        }

        // Check if bookmark already exists
        const existingBookmark = await db.select()
            .from(userBookmarksTable)
            .where(and(
                eq(userBookmarksTable.userId, userId),
                eq(userBookmarksTable.postId, input.postId)
            ))
            .execute();

        if (existingBookmark.length > 0) {
            // Remove bookmark
            await db.delete(userBookmarksTable)
                .where(and(
                    eq(userBookmarksTable.userId, userId),
                    eq(userBookmarksTable.postId, input.postId)
                ))
                .execute();
        } else {
            // Add bookmark
            await db.insert(userBookmarksTable)
                .values({
                    userId: userId,
                    postId: input.postId
                })
                .execute();
        }

        return true;
    } catch (error) {
        console.error('Failed to toggle bookmark:', error);
        throw error;
    }
}

export async function getUserBookmarks(userId: number): Promise<ForumPost[]> {
    try {
        const results = await db.select()
            .from(forumPostsTable)
            .innerJoin(
                userBookmarksTable,
                eq(forumPostsTable.id, userBookmarksTable.postId)
            )
            .where(eq(userBookmarksTable.userId, userId))
            .orderBy(desc(forumPostsTable.createdAt))
            .execute();

        // Extract forum posts from joined results
        return results.map(result => (result as any).forum_posts);
    } catch (error) {
        console.error('Failed to fetch user bookmarks:', error);
        throw error;
    }
}