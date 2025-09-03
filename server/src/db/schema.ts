import { serial, text, pgTable, timestamp, boolean, integer, pgEnum, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const professionalTypeEnum = pgEnum('professional_type', ['clinician', 'lab_technician', 'specialist', 'student', 'educator']);
export const voteTypeEnum = pgEnum('vote_type', ['up', 'down']);
export const caseTypeEnum = pgEnum('case_type', ['crown', 'bridge', 'implant', 'orthodontic', 'surgical_guide', 'denture', 'other']);
export const priorityEnum = pgEnum('priority', ['low', 'medium', 'high', 'urgent']);
export const caseStatusEnum = pgEnum('case_status', ['draft', 'active', 'in_progress', 'completed', 'cancelled']);
export const collaboratorRoleEnum = pgEnum('collaborator_role', ['viewer', 'editor', 'owner']);
export const notificationTypeEnum = pgEnum('notification_type', ['case_update', 'comment', 'mention', 'collaboration_invite', 'vote']);
export const activityTypeEnum = pgEnum('activity_type', ['case_created', 'case_updated', 'post_created', 'comment_added', 'file_uploaded', 'collaboration_started']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(), // Will be hashed
  avatarUrl: text('avatar_url'), // Nullable by default
  professionalType: professionalTypeEnum('professional_type').notNull(),
  isVerified: boolean('is_verified').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Forum Categories table
export const forumCategoriesTable = pgTable('forum_categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'), // Nullable by default
});

// Forum Posts table
export const forumPostsTable = pgTable('forum_posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  excerpt: text('excerpt'), // Nullable by default
  authorId: integer('author_id').references(() => usersTable.id).notNull(),
  categoryId: integer('category_id').references(() => forumCategoriesTable.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  upvotes: integer('upvotes').notNull().default(0),
  downvotes: integer('downvotes').notNull().default(0),
  viewCount: integer('view_count').notNull().default(0),
  commentCount: integer('comment_count').notNull().default(0),
});

// Forum Post Tags table
export const forumPostTagsTable = pgTable('forum_post_tags', {
  postId: integer('post_id').references(() => forumPostsTable.id).notNull(),
  tag: text('tag').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.postId, table.tag] }),
}));

// Forum Comments table
export const forumCommentsTable = pgTable('forum_comments', {
  id: serial('id').primaryKey(),
  postId: integer('post_id').references(() => forumPostsTable.id).notNull(),
  authorId: integer('author_id').references(() => usersTable.id).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User Post Votes table
export const userPostVotesTable = pgTable('user_post_votes', {
  userId: integer('user_id').references(() => usersTable.id).notNull(),
  postId: integer('post_id').references(() => forumPostsTable.id).notNull(),
  voteType: voteTypeEnum('vote_type').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.postId] }),
}));

// User Bookmarks table
export const userBookmarksTable = pgTable('user_bookmarks', {
  userId: integer('user_id').references(() => usersTable.id).notNull(),
  postId: integer('post_id').references(() => forumPostsTable.id).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.postId] }),
}));

// Cases table
export const casesTable = pgTable('cases', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  caseType: caseTypeEnum('case_type').notNull(),
  priority: priorityEnum('priority').notNull(),
  patientAge: integer('patient_age'), // Nullable by default
  isPublic: boolean('is_public').notNull().default(false),
  creatorId: integer('creator_id').references(() => usersTable.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  status: caseStatusEnum('status').notNull().default('draft'),
});

// Case Tags table
export const caseTagsTable = pgTable('case_tags', {
  caseId: integer('case_id').references(() => casesTable.id).notNull(),
  tag: text('tag').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.caseId, table.tag] }),
}));

// Case Collaborators table
export const caseCollaboratorsTable = pgTable('case_collaborators', {
  caseId: integer('case_id').references(() => casesTable.id).notNull(),
  userId: integer('user_id').references(() => usersTable.id).notNull(),
  role: collaboratorRoleEnum('role').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.caseId, table.userId] }),
}));

// Case Files table
export const caseFilesTable = pgTable('case_files', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id').references(() => casesTable.id).notNull(),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  fileType: text('file_type').notNull(),
  fileSize: integer('file_size').notNull(),
  uploadDate: timestamp('upload_date').defaultNow().notNull(),
  uploadedBy: integer('uploaded_by').references(() => usersTable.id).notNull(),
  annotations: text('annotations'), // JSON string, nullable by default
});

// Notifications table
export const notificationsTable = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => usersTable.id).notNull(),
  type: notificationTypeEnum('type').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  metadata: text('metadata'), // JSON string, nullable by default
});

// Activity Logs table
export const activityLogsTable = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => usersTable.id).notNull(),
  type: activityTypeEnum('type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  metadata: text('metadata'), // JSON string, nullable by default
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  forumPosts: many(forumPostsTable),
  forumComments: many(forumCommentsTable),
  postVotes: many(userPostVotesTable),
  bookmarks: many(userBookmarksTable),
  cases: many(casesTable),
  caseCollaborations: many(caseCollaboratorsTable),
  uploadedFiles: many(caseFilesTable),
  notifications: many(notificationsTable),
  activities: many(activityLogsTable),
}));

export const forumCategoriesRelations = relations(forumCategoriesTable, ({ many }) => ({
  posts: many(forumPostsTable),
}));

export const forumPostsRelations = relations(forumPostsTable, ({ one, many }) => ({
  author: one(usersTable, {
    fields: [forumPostsTable.authorId],
    references: [usersTable.id],
  }),
  category: one(forumCategoriesTable, {
    fields: [forumPostsTable.categoryId],
    references: [forumCategoriesTable.id],
  }),
  tags: many(forumPostTagsTable),
  comments: many(forumCommentsTable),
  votes: many(userPostVotesTable),
  bookmarks: many(userBookmarksTable),
}));

export const forumPostTagsRelations = relations(forumPostTagsTable, ({ one }) => ({
  post: one(forumPostsTable, {
    fields: [forumPostTagsTable.postId],
    references: [forumPostsTable.id],
  }),
}));

export const forumCommentsRelations = relations(forumCommentsTable, ({ one }) => ({
  post: one(forumPostsTable, {
    fields: [forumCommentsTable.postId],
    references: [forumPostsTable.id],
  }),
  author: one(usersTable, {
    fields: [forumCommentsTable.authorId],
    references: [usersTable.id],
  }),
}));

export const userPostVotesRelations = relations(userPostVotesTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [userPostVotesTable.userId],
    references: [usersTable.id],
  }),
  post: one(forumPostsTable, {
    fields: [userPostVotesTable.postId],
    references: [forumPostsTable.id],
  }),
}));

export const userBookmarksRelations = relations(userBookmarksTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [userBookmarksTable.userId],
    references: [usersTable.id],
  }),
  post: one(forumPostsTable, {
    fields: [userBookmarksTable.postId],
    references: [forumPostsTable.id],
  }),
}));

export const casesRelations = relations(casesTable, ({ one, many }) => ({
  creator: one(usersTable, {
    fields: [casesTable.creatorId],
    references: [usersTable.id],
  }),
  tags: many(caseTagsTable),
  collaborators: many(caseCollaboratorsTable),
  files: many(caseFilesTable),
}));

export const caseTagsRelations = relations(caseTagsTable, ({ one }) => ({
  case: one(casesTable, {
    fields: [caseTagsTable.caseId],
    references: [casesTable.id],
  }),
}));

export const caseCollaboratorsRelations = relations(caseCollaboratorsTable, ({ one }) => ({
  case: one(casesTable, {
    fields: [caseCollaboratorsTable.caseId],
    references: [casesTable.id],
  }),
  user: one(usersTable, {
    fields: [caseCollaboratorsTable.userId],
    references: [usersTable.id],
  }),
}));

export const caseFilesRelations = relations(caseFilesTable, ({ one }) => ({
  case: one(casesTable, {
    fields: [caseFilesTable.caseId],
    references: [casesTable.id],
  }),
  uploader: one(usersTable, {
    fields: [caseFilesTable.uploadedBy],
    references: [usersTable.id],
  }),
}));

export const notificationsRelations = relations(notificationsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [notificationsTable.userId],
    references: [usersTable.id],
  }),
}));

export const activityLogsRelations = relations(activityLogsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [activityLogsTable.userId],
    references: [usersTable.id],
  }),
}));

// Export all tables for enabling relation queries
export const tables = {
  users: usersTable,
  forumCategories: forumCategoriesTable,
  forumPosts: forumPostsTable,
  forumPostTags: forumPostTagsTable,
  forumComments: forumCommentsTable,
  userPostVotes: userPostVotesTable,
  userBookmarks: userBookmarksTable,
  cases: casesTable,
  caseTags: caseTagsTable,
  caseCollaborators: caseCollaboratorsTable,
  caseFiles: caseFilesTable,
  notifications: notificationsTable,
  activityLogs: activityLogsTable,
};

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type ForumCategory = typeof forumCategoriesTable.$inferSelect;
export type NewForumCategory = typeof forumCategoriesTable.$inferInsert;

export type ForumPost = typeof forumPostsTable.$inferSelect;
export type NewForumPost = typeof forumPostsTable.$inferInsert;

export type ForumPostTag = typeof forumPostTagsTable.$inferSelect;
export type NewForumPostTag = typeof forumPostTagsTable.$inferInsert;

export type ForumComment = typeof forumCommentsTable.$inferSelect;
export type NewForumComment = typeof forumCommentsTable.$inferInsert;

export type UserPostVote = typeof userPostVotesTable.$inferSelect;
export type NewUserPostVote = typeof userPostVotesTable.$inferInsert;

export type UserBookmark = typeof userBookmarksTable.$inferSelect;
export type NewUserBookmark = typeof userBookmarksTable.$inferInsert;

export type Case = typeof casesTable.$inferSelect;
export type NewCase = typeof casesTable.$inferInsert;

export type CaseTag = typeof caseTagsTable.$inferSelect;
export type NewCaseTag = typeof caseTagsTable.$inferInsert;

export type CaseCollaborator = typeof caseCollaboratorsTable.$inferSelect;
export type NewCaseCollaborator = typeof caseCollaboratorsTable.$inferInsert;

export type CaseFile = typeof caseFilesTable.$inferSelect;
export type NewCaseFile = typeof caseFilesTable.$inferInsert;

export type Notification = typeof notificationsTable.$inferSelect;
export type NewNotification = typeof notificationsTable.$inferInsert;

export type ActivityLog = typeof activityLogsTable.$inferSelect;
export type NewActivityLog = typeof activityLogsTable.$inferInsert;