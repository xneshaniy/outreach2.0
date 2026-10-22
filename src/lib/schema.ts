import { pgTable, text, integer, real, boolean, timestamp, uniqueIndex, index, primaryKey } from 'drizzle-orm/pg-core';

export const contentPosts = pgTable('content_posts', {
  id: text('id').primaryKey(),
  platform: text('platform').notNull(),
  format: text('format').notNull(),
  pillar: integer('pillar'),
  textPreview: text('text_preview'),
  fullContent: text('full_content'),
  status: text('status').notNull().default('draft'),
  scheduledFor: timestamp('scheduled_for'),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  impressions: integer('impressions').default(0).notNull(),
  likes: integer('likes').default(0).notNull(),
  replies: integer('replies').default(0).notNull(),
  reposts: integer('reposts').default(0).notNull(),
  saves: integer('saves').default(0).notNull(),
  engagementRate: real('engagement_rate').default(0).notNull(),
  imageUrl: text('image_url'),
}, (table) => ({
  idxContentStatus: index('idx_content_status').on(table.status),
  idxContentPlatform: index('idx_content_platform').on(table.platform),
}));

export const leads = pgTable('leads', {
  id: text('id').primaryKey(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  title: text('title'),
  company: text('company'),
  companySize: text('company_size'),
  industrySegment: text('industry_segment'),
  source: text('source'),
  email: text('email'),
  linkedinUrl: text('linkedin_url'),
  status: text('status').notNull().default('new'),
  score: integer('score'),
  tier: text('tier'),
  lastTouchAt: timestamp('last_touch_at'),
  nextActionAt: timestamp('next_action_at'),
  sequenceName: text('sequence_name'),
  replyType: text('reply_type'),
  notes: text('notes'),
  pauseOutreach: integer('pause_outreach').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  idxLeadsStatus: index('idx_leads_status').on(table.status),
  idxLeadsTier: index('idx_leads_tier').on(table.tier),
}));

export const sequences = pgTable('sequences', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').references(() => leads.id),
  sequenceName: text('sequence_name'),
  step: integer('step'),
  subject: text('subject'),
  body: text('body'),
  status: text('status'),
  tier: text('tier'),
  scheduledFor: timestamp('scheduled_for'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  idxSequencesStatus: index('idx_sequences_status').on(table.status),
  idxSequencesLead: index('idx_sequences_lead').on(table.leadId),
}));

export const suppression = pgTable('suppression', {
  email: text('email').primaryKey(),
  type: text('type'),
  addedAt: timestamp('added_at').defaultNow().notNull(),
});

export const engagements = pgTable('engagements', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  platform: text('platform'),
  actionType: text('action_type'),
  targetUrl: text('target_url'),
  targetUsername: text('target_username'),
  ourText: text('our_text'),
  status: text('status'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  idxEngagementsPlatform: index('idx_engagements_platform').on(table.platform),
}));

export const signals = pgTable('signals', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  date: text('date'),
  type: text('type'),
  username: text('username'),
  tweetUrl: text('tweet_url'),
  summary: text('summary'),
  relevance: text('relevance'),
  actionTaken: text('action_taken'),
  likes: integer('likes'),
  impressions: integer('impressions'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  idxSignalsType: index('idx_signals_type').on(table.type),
  idxSignalsDate: index('idx_signals_date').on(table.date),
}));

export const experiments = pgTable('experiments', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  week: integer('week'),
  hypothesis: text('hypothesis'),
  action: text('action'),
  metric: text('metric'),
  winThreshold: text('win_threshold'),
  status: text('status'),
  results: text('results'),
  winner: text('winner'),
  margin: text('margin'),
  decision: text('decision'),
  learning: text('learning'),
  nextAction: text('next_action'),
  proposedAt: timestamp('proposed_at'),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  idxExperimentsStatus: index('idx_experiments_status').on(table.status),
}));

export const learnings = pgTable('learnings', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  learning: text('learning'),
  validatedWeek: integer('validated_week'),
  confidence: text('confidence'),
  appliedTo: text('applied_to'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const dailyMetrics = pgTable('daily_metrics', {
  date: text('date').primaryKey(),
  xPosts: integer('x_posts').default(0).notNull(),
  xThreads: integer('x_threads').default(0).notNull(),
  linkedinDrafts: integer('linkedin_drafts').default(0).notNull(),
  xReplies: integer('x_replies').default(0).notNull(),
  xQuoteTweets: integer('x_quote_tweets').default(0).notNull(),
  xFollows: integer('x_follows').default(0).notNull(),
  linkedinComments: integer('linkedin_comments').default(0).notNull(),
  discoveries: integer('discoveries').default(0).notNull(),
  enrichments: integer('enrichments').default(0).notNull(),
  sends: integer('sends').default(0).notNull(),
  repliesTriaged: integer('replies_triaged').default(0).notNull(),
  optOuts: integer('opt_outs').default(0).notNull(),
  bounces: integer('bounces').default(0).notNull(),
  totalImpressions: integer('total_impressions').default(0).notNull(),
  totalEngagement: integer('total_engagement').default(0).notNull(),
});

export const activityLog = pgTable('activity_log', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  ts: timestamp('ts'),
  action: text('action'),
  detail: text('detail'),
  result: text('result'),
}, (table) => ({
  idxActivityAction: index('idx_activity_action').on(table.action),
  idxActivityTs: index('idx_activity_ts').on(table.ts),
}));

export const notifications = pgTable('notifications', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  type: text('type').notNull(),
  severity: text('severity').notNull().default('info'),
  title: text('title'),
  message: text('message').notNull(),
  data: text('data'),
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  idxNotificationsRead: index('idx_notifications_read').on(table.read),
  idxNotificationsCreated: index('idx_notifications_created').on(table.createdAt),
}));

export const seedRegistry = pgTable('seed_registry', {
  tableName: text('table_name').notNull(),
  recordId: text('record_id').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.tableName, table.recordId] }),
}));

export const messages = pgTable('messages', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  conversationId: text('conversation_id').notNull(),
  fromAgent: text('from_agent').notNull(),
  toAgent: text('to_agent'),
  content: text('content').notNull(),
  messageType: text('message_type').notNull().default('text'),
  metadata: text('metadata'),
  readAt: integer('read_at'),
  createdAt: integer('created_at').notNull().default(0),
}, (table) => ({
  idxMessagesConversation: index('idx_messages_conversation').on(table.conversationId, table.createdAt),
  idxMessagesAgents: index('idx_messages_agents').on(table.fromAgent, table.toAgent),
}));

export const sessionSync = pgTable('session_sync', {
  sessionFile: text('session_file').primaryKey(),
  lastOffset: integer('last_offset').default(0).notNull(),
  lastSyncedAt: integer('last_synced_at'),
});

export const llmUsageEvents = pgTable('llm_usage_events', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  day: text('day').notNull(),
  agentId: text('agent_id'),
  model: text('model'),
  totalTokens: integer('total_tokens').default(0).notNull(),
  costUsd: real('cost_usd').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  idxLlmUsageDay: index('idx_llm_usage_day').on(table.day),
  idxLlmUsageAgent: index('idx_llm_usage_agent').on(table.agentId, table.day),
}));

export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('admin'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  email: text('email').unique(),
  authProvider: text('auth_provider').notNull().default('local'),
  googleSub: text('google_sub').unique(),
}, (table) => ({
  idxUsersGoogleSub: uniqueIndex('idx_users_google_sub').on(table.googleSub),
  idxUsersEmail: uniqueIndex('idx_users_email').on(table.email),
}));

export const sessions = pgTable('sessions', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  token: text('token').unique().notNull(),
  userId: integer('user_id').references(() => users.id),
  expiresAt: integer('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  idxSessionsToken: index('idx_sessions_token').on(table.token),
}));

export const googleLoginRequests = pgTable('google_login_requests', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  email: text('email').unique().notNull(),
  googleSub: text('google_sub'),
  status: text('status').notNull().default('pending'),
  requestedRole: text('requested_role').notNull().default('viewer'),
  attempts: integer('attempts').default(1).notNull(),
  lastError: text('last_error'),
  lastAttemptAt: timestamp('last_attempt_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
}, (table) => ({
  idxGoogleLoginRequestsStatus: index('idx_google_login_requests_status').on(table.status),
}));

// Type exports for use in queries
export type ContentPost = typeof contentPosts.$inferSelect;
export type NewContentPost = typeof contentPosts.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Sequence = typeof sequences.$inferSelect;
export type NewSequence = typeof sequences.$inferInsert;
export type Suppression = typeof suppression.$inferSelect;
export type NewSuppression = typeof suppression.$inferInsert;
export type Engagement = typeof engagements.$inferSelect;
export type NewEngagement = typeof engagements.$inferInsert;
export type Signal = typeof signals.$inferSelect;
export type NewSignal = typeof signals.$inferInsert;
export type Experiment = typeof experiments.$inferSelect;
export type NewExperiment = typeof experiments.$inferInsert;
export type Learning = typeof learnings.$inferSelect;
export type NewLearning = typeof learnings.$inferInsert;
export type DailyMetrics = typeof dailyMetrics.$inferSelect;
export type NewDailyMetrics = typeof dailyMetrics.$inferInsert;
export type ActivityEntry = typeof activityLog.$inferSelect;
export type NewActivityEntry = typeof activityLog.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type SeedRegistry = typeof seedRegistry.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type SessionSync = typeof sessionSync.$inferSelect;
export type LlmUsageEvent = typeof llmUsageEvents.$inferSelect;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type GoogleLoginRequest = typeof googleLoginRequests.$inferSelect;
export type NewGoogleLoginRequest = typeof googleLoginRequests.$inferInsert;