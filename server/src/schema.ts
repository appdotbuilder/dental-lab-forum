import { z } from 'zod';

// Enums
export const professionalTypeEnum = z.enum(['clinician', 'lab_technician', 'specialist', 'student', 'educator']);
export const voteTypeEnum = z.enum(['up', 'down']);
export const caseTypeEnum = z.enum(['crown', 'bridge', 'implant', 'orthodontic', 'surgical_guide', 'denture', 'other']);
export const priorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);
export const caseStatusEnum = z.enum(['draft', 'active', 'in_progress', 'completed', 'cancelled']);
export const collaboratorRoleEnum = z.enum(['viewer', 'editor', 'owner']);
export const notificationTypeEnum = z.enum(['case_update', 'comment', 'mention', 'collaboration_invite', 'vote']);
export const activityTypeEnum = z.enum(['case_created', 'case_updated', 'post_created', 'comment_added', 'file_uploaded', 'collaboration_started']);

// User schemas
export const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  password: z.string(), // Will be hashed
  avatarUrl: z.string().nullable(),
  professionalType: professionalTypeEnum,
  isVerified: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// User input schemas
export const createUserInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  avatarUrl: z.string().url().nullable().optional(),
  professionalType: professionalTypeEnum
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Forum Category schemas
export const forumCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable()
});

export type ForumCategory = z.infer<typeof forumCategorySchema>;

export const createForumCategoryInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional()
});

export type CreateForumCategoryInput = z.infer<typeof createForumCategoryInputSchema>;

// Forum Post schemas
export const forumPostSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  excerpt: z.string().nullable(),
  authorId: z.number(),
  categoryId: z.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  upvotes: z.number().int(),
  downvotes: z.number().int(),
  viewCount: z.number().int(),
  commentCount: z.number().int()
});

export type ForumPost = z.infer<typeof forumPostSchema>;

export const createForumPostInputSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  excerpt: z.string().nullable().optional(),
  categoryId: z.number(),
  tags: z.array(z.string()).optional()
});

export type CreateForumPostInput = z.infer<typeof createForumPostInputSchema>;

export const updateForumPostInputSchema = z.object({
  id: z.number(),
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  excerpt: z.string().nullable().optional(),
  categoryId: z.number().optional(),
  tags: z.array(z.string()).optional()
});

export type UpdateForumPostInput = z.infer<typeof updateForumPostInputSchema>;

// Forum Post Tag schemas
export const forumPostTagSchema = z.object({
  postId: z.number(),
  tag: z.string()
});

export type ForumPostTag = z.infer<typeof forumPostTagSchema>;

// Forum Comment schemas
export const forumCommentSchema = z.object({
  id: z.number(),
  postId: z.number(),
  authorId: z.number(),
  content: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export type ForumComment = z.infer<typeof forumCommentSchema>;

export const createForumCommentInputSchema = z.object({
  postId: z.number(),
  content: z.string().min(1)
});

export type CreateForumCommentInput = z.infer<typeof createForumCommentInputSchema>;

// User Post Vote schemas
export const userPostVoteSchema = z.object({
  userId: z.number(),
  postId: z.number(),
  voteType: voteTypeEnum
});

export type UserPostVote = z.infer<typeof userPostVoteSchema>;

export const votePostInputSchema = z.object({
  postId: z.number(),
  voteType: voteTypeEnum
});

export type VotePostInput = z.infer<typeof votePostInputSchema>;

// User Bookmark schemas
export const userBookmarkSchema = z.object({
  userId: z.number(),
  postId: z.number()
});

export type UserBookmark = z.infer<typeof userBookmarkSchema>;

export const bookmarkPostInputSchema = z.object({
  postId: z.number()
});

export type BookmarkPostInput = z.infer<typeof bookmarkPostInputSchema>;

// Case schemas
export const caseSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  caseType: caseTypeEnum,
  priority: priorityEnum,
  patientAge: z.number().int().nullable(),
  isPublic: z.boolean(),
  creatorId: z.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  status: caseStatusEnum
});

export type Case = z.infer<typeof caseSchema>;

export const createCaseInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  caseType: caseTypeEnum,
  priority: priorityEnum,
  patientAge: z.number().int().nullable().optional(),
  isPublic: z.boolean().optional(),
  tags: z.array(z.string()).optional()
});

export type CreateCaseInput = z.infer<typeof createCaseInputSchema>;

export const updateCaseInputSchema = z.object({
  id: z.number(),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  caseType: caseTypeEnum.optional(),
  priority: priorityEnum.optional(),
  patientAge: z.number().int().nullable().optional(),
  isPublic: z.boolean().optional(),
  status: caseStatusEnum.optional(),
  tags: z.array(z.string()).optional()
});

export type UpdateCaseInput = z.infer<typeof updateCaseInputSchema>;

// Case Tag schemas
export const caseTagSchema = z.object({
  caseId: z.number(),
  tag: z.string()
});

export type CaseTag = z.infer<typeof caseTagSchema>;

// Case Collaborator schemas
export const caseCollaboratorSchema = z.object({
  caseId: z.number(),
  userId: z.number(),
  role: collaboratorRoleEnum
});

export type CaseCollaborator = z.infer<typeof caseCollaboratorSchema>;

export const addCollaboratorInputSchema = z.object({
  caseId: z.number(),
  userId: z.number(),
  role: collaboratorRoleEnum
});

export type AddCollaboratorInput = z.infer<typeof addCollaboratorInputSchema>;

// Case File schemas
export const caseFileSchema = z.object({
  id: z.number(),
  caseId: z.number(),
  fileName: z.string(),
  fileUrl: z.string(),
  fileType: z.string(),
  fileSize: z.number().int(),
  uploadDate: z.coerce.date(),
  uploadedBy: z.number(),
  annotations: z.string().nullable() // JSON string
});

export type CaseFile = z.infer<typeof caseFileSchema>;

export const uploadFileInputSchema = z.object({
  caseId: z.number(),
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number().int()
});

export type UploadFileInput = z.infer<typeof uploadFileInputSchema>;

export const updateAnnotationsInputSchema = z.object({
  fileId: z.number(),
  annotations: z.string() // JSON string
});

export type UpdateAnnotationsInput = z.infer<typeof updateAnnotationsInputSchema>;

// Notification schemas
export const notificationSchema = z.object({
  id: z.number(),
  userId: z.number(),
  type: notificationTypeEnum,
  message: z.string(),
  isRead: z.boolean(),
  createdAt: z.coerce.date(),
  metadata: z.string().nullable() // JSON string
});

export type Notification = z.infer<typeof notificationSchema>;

export const createNotificationInputSchema = z.object({
  userId: z.number(),
  type: notificationTypeEnum,
  message: z.string(),
  metadata: z.string().nullable().optional()
});

export type CreateNotificationInput = z.infer<typeof createNotificationInputSchema>;

export const markNotificationReadInputSchema = z.object({
  notificationId: z.number()
});

export type MarkNotificationReadInput = z.infer<typeof markNotificationReadInputSchema>;

// Activity Log schemas
export const activityLogSchema = z.object({
  id: z.number(),
  userId: z.number(),
  type: activityTypeEnum,
  title: z.string(),
  description: z.string(),
  timestamp: z.coerce.date(),
  metadata: z.string().nullable() // JSON string
});

export type ActivityLog = z.infer<typeof activityLogSchema>;

export const createActivityLogInputSchema = z.object({
  userId: z.number(),
  type: activityTypeEnum,
  title: z.string(),
  description: z.string(),
  metadata: z.string().nullable().optional()
});

export type CreateActivityLogInput = z.infer<typeof createActivityLogInputSchema>;

// Dashboard stats schema
export const dashboardStatsSchema = z.object({
  totalCases: z.number().int(),
  activeCases: z.number().int(),
  totalPosts: z.number().int(),
  activeUsers: z.number().int(),
  totalEngagement: z.number().int()
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

// Query schemas
export const paginationInputSchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional()
});

export type PaginationInput = z.infer<typeof paginationInputSchema>;

export const forumPostsQueryInputSchema = paginationInputSchema.extend({
  categoryId: z.number().optional(),
  tag: z.string().optional(),
  authorId: z.number().optional(),
  sortBy: z.enum(['newest', 'oldest', 'mostVoted', 'mostCommented']).optional()
});

export type ForumPostsQueryInput = z.infer<typeof forumPostsQueryInputSchema>;

export const casesQueryInputSchema = paginationInputSchema.extend({
  caseType: caseTypeEnum.optional(),
  priority: priorityEnum.optional(),
  status: caseStatusEnum.optional(),
  isPublic: z.boolean().optional(),
  creatorId: z.number().optional(),
  tag: z.string().optional(),
  sortBy: z.enum(['newest', 'oldest', 'priority', 'status']).optional()
});

export type CasesQueryInput = z.infer<typeof casesQueryInputSchema>;