import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserInputSchema,
  loginInputSchema,
  createForumCategoryInputSchema,
  createForumPostInputSchema,
  updateForumPostInputSchema,
  forumPostsQueryInputSchema,
  createForumCommentInputSchema,
  votePostInputSchema,
  bookmarkPostInputSchema,
  createCaseInputSchema,
  updateCaseInputSchema,
  casesQueryInputSchema,
  addCollaboratorInputSchema,
  uploadFileInputSchema,
  updateAnnotationsInputSchema,
  createNotificationInputSchema,
  markNotificationReadInputSchema,
  createActivityLogInputSchema,
  paginationInputSchema
} from './schema';

// Import handlers
import {
  registerUser,
  loginUser,
  getCurrentUser,
  getUserById,
  getUsers
} from './handlers/auth';

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
} from './handlers/forum';

import {
  getCases,
  getCaseById,
  createCase,
  updateCase,
  deleteCase,
  addCaseCollaborator,
  removeCaseCollaborator,
  getCaseCollaborators,
  getCaseFiles,
  uploadCaseFile,
  getFileAnnotations,
  updateFileAnnotations
} from './handlers/cases';

import {
  getUserNotifications,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount
} from './handlers/notifications';

import {
  getDashboardStats,
  getActivityFeed,
  createActivityLog,
  getUserActivity
} from './handlers/dashboard';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

// TODO: Implement proper authentication middleware
// const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
//   // Add authentication logic here
//   return next();
// });

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  auth: router({
    register: publicProcedure
      .input(createUserInputSchema)
      .mutation(({ input }) => registerUser(input)),
    
    login: publicProcedure
      .input(loginInputSchema)
      .mutation(({ input }) => loginUser(input)),
    
    me: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => getCurrentUser(input.userId)),
  }),

  // User routes
  users: router({
    getById: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => getUserById(input.userId)),
    
    list: publicProcedure
      .input(z.object({
        professionalType: z.string().optional(),
        page: z.number().optional(),
        limit: z.number().optional()
      }))
      .query(({ input }) => getUsers(input)),
  }),

  // Forum routes
  forum: router({
    // Categories
    categories: router({
      list: publicProcedure
        .query(() => getForumCategories()),
      
      create: publicProcedure
        .input(createForumCategoryInputSchema)
        .mutation(({ input }) => createForumCategory(input)),
    }),

    // Posts
    posts: router({
      list: publicProcedure
        .input(forumPostsQueryInputSchema)
        .query(({ input }) => getForumPosts(input)),
      
      getById: publicProcedure
        .input(z.object({ postId: z.number(), userId: z.number().optional() }))
        .query(({ input }) => getForumPostById(input.postId, input.userId)),
      
      create: publicProcedure
        .input(createForumPostInputSchema.extend({ authorId: z.number() }))
        .mutation(({ input }) => createForumPost(input, input.authorId)),
      
      update: publicProcedure
        .input(updateForumPostInputSchema.extend({ userId: z.number() }))
        .mutation(({ input }) => updateForumPost(input, input.userId)),
      
      delete: publicProcedure
        .input(z.object({ postId: z.number(), userId: z.number() }))
        .mutation(({ input }) => deleteForumPost(input.postId, input.userId)),
      
      vote: publicProcedure
        .input(votePostInputSchema.extend({ userId: z.number() }))
        .mutation(({ input }) => voteOnPost(input, input.userId)),
      
      bookmark: publicProcedure
        .input(bookmarkPostInputSchema.extend({ userId: z.number() }))
        .mutation(({ input }) => toggleBookmark(input, input.userId)),
    }),

    // Comments
    comments: router({
      list: publicProcedure
        .input(z.object({ postId: z.number() }))
        .query(({ input }) => getForumComments(input.postId)),
      
      create: publicProcedure
        .input(createForumCommentInputSchema.extend({ authorId: z.number() }))
        .mutation(({ input }) => createForumComment(input, input.authorId)),
    }),

    // Bookmarks
    bookmarks: router({
      getUserBookmarks: publicProcedure
        .input(z.object({ userId: z.number() }))
        .query(({ input }) => getUserBookmarks(input.userId)),
    }),
  }),

  // Cases routes
  cases: router({
    list: publicProcedure
      .input(casesQueryInputSchema.extend({ userId: z.number().optional() }))
      .query(({ input }) => getCases(input, input.userId)),
    
    getById: publicProcedure
      .input(z.object({ caseId: z.number(), userId: z.number().optional() }))
      .query(({ input }) => getCaseById(input.caseId, input.userId)),
    
    create: publicProcedure
      .input(createCaseInputSchema.extend({ creatorId: z.number() }))
      .mutation(({ input }) => createCase(input, input.creatorId)),
    
    update: publicProcedure
      .input(updateCaseInputSchema.extend({ userId: z.number() }))
      .mutation(({ input }) => updateCase(input, input.userId)),
    
    delete: publicProcedure
      .input(z.object({ caseId: z.number(), userId: z.number() }))
      .mutation(({ input }) => deleteCase(input.caseId, input.userId)),

    // Collaborators
    collaborators: router({
      list: publicProcedure
        .input(z.object({ caseId: z.number(), userId: z.number() }))
        .query(({ input }) => getCaseCollaborators(input.caseId, input.userId)),
      
      add: publicProcedure
        .input(addCollaboratorInputSchema.extend({ requesterId: z.number() }))
        .mutation(({ input }) => addCaseCollaborator(input, input.requesterId)),
      
      remove: publicProcedure
        .input(z.object({ caseId: z.number(), userId: z.number(), requesterId: z.number() }))
        .mutation(({ input }) => removeCaseCollaborator(input.caseId, input.userId, input.requesterId)),
    }),

    // Files
    files: router({
      list: publicProcedure
        .input(z.object({ caseId: z.number(), userId: z.number() }))
        .query(({ input }) => getCaseFiles(input.caseId, input.userId)),
      
      upload: publicProcedure
        .input(uploadFileInputSchema.extend({ userId: z.number() }))
        .mutation(({ input }) => uploadCaseFile(input, input.userId)),
      
      annotations: router({
        get: publicProcedure
          .input(z.object({ fileId: z.number(), userId: z.number() }))
          .query(({ input }) => getFileAnnotations(input.fileId, input.userId)),
        
        update: publicProcedure
          .input(updateAnnotationsInputSchema.extend({ userId: z.number() }))
          .mutation(({ input }) => updateFileAnnotations(input, input.userId)),
      }),
    }),
  }),

  // Notifications routes
  notifications: router({
    list: publicProcedure
      .input(z.object({ 
        userId: z.number(), 
        unreadOnly: z.boolean().optional(),
        page: z.number().optional(),
        limit: z.number().optional()
      }))
      .query(({ input }) => getUserNotifications(input.userId, input)),
    
    create: publicProcedure
      .input(createNotificationInputSchema)
      .mutation(({ input }) => createNotification(input)),
    
    markRead: publicProcedure
      .input(markNotificationReadInputSchema.extend({ userId: z.number() }))
      .mutation(({ input }) => markNotificationRead(input, input.userId)),
    
    markAllRead: publicProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(({ input }) => markAllNotificationsRead(input.userId)),
    
    unreadCount: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => getUnreadNotificationCount(input.userId)),
  }),

  // Dashboard routes
  dashboard: router({
    stats: publicProcedure
      .query(() => getDashboardStats()),
    
    activity: publicProcedure
      .input(z.object({
        userId: z.number().optional(),
        page: z.number().optional(),
        limit: z.number().optional()
      }))
      .query(({ input }) => getActivityFeed(input)),
    
    createActivity: publicProcedure
      .input(createActivityLogInputSchema)
      .mutation(({ input }) => createActivityLog(input)),
    
    userActivity: publicProcedure
      .input(z.object({
        userId: z.number(),
        page: z.number().optional(),
        limit: z.number().optional()
      }))
      .query(({ input }) => getUserActivity(input.userId, input)),
  }),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();