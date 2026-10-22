import { db } from './db-neon';
import { 
  contentPosts, leads, sequences, suppression, engagements, signals, 
  experiments, learnings, dailyMetrics, activityLog, notifications, 
  seedRegistry
} from './schema';
import { eq, and, or, desc, asc, sql, lt, gt, inArray, not, count } from 'drizzle-orm';
import type { 
  ContentPost, Lead, Sequence, Suppression, Engagement, Signal, 
  Experiment, Learning, DailyMetrics, ActivityEntry, OverviewStats, Alert, 
  FunnelStep, WeeklyKPI, Notification as NotificationType 
} from '@/types';

// Convert camelCase object keys to snake_case
function toSnakeCase<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    result[snakeKey] = value;
  }
  return result as T;
}

function toSnakeCaseArray<T extends Record<string, unknown>>(arr: T[]): T[] {
  return arr.map(toSnakeCase) as T[];
}

// ─── Overview ──────────────────────────────────────────
export async function getOverviewStats(filters?: { excludeSeed?: boolean }): Promise<OverviewStats> {
  const today = new Date().toISOString().slice(0, 10);

  const [postsToday, engagementToday, emailsSent, pipelineCount] = await Promise.all([
    db.select({ c: count() })
      .from(contentPosts)
      .where(
        filters?.excludeSeed
          ? and(
              or(
                sql`date(${contentPosts.publishedAt}) = ${today}`,
                sql`date(${contentPosts.createdAt}) = ${today}`
              ),
              not(sql`EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'content_posts' AND sr.record_id = CAST(${contentPosts.id} AS TEXT))`)
            )
          : or(
              sql`date(${contentPosts.publishedAt}) = ${today}`,
              sql`date(${contentPosts.createdAt}) = ${today}`
            )
      ),
    db.select({ c: count() })
      .from(engagements)
      .where(
        filters?.excludeSeed
          ? and(
              sql`date(${engagements.createdAt}) = ${today}`,
              not(sql`EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'engagements' AND sr.record_id = CAST(${engagements.id} AS TEXT))`)
            )
          : sql`date(${engagements.createdAt}) = ${today}`
      ),
    db.select({ c: count() })
      .from(sequences)
      .where(
        filters?.excludeSeed
          ? and(
              eq(sequences.status, 'sent'),
              sql`date(${sequences.sentAt}) = ${today}`,
              not(sql`EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'sequences' AND sr.record_id = CAST(${sequences.id} AS TEXT))`)
            )
          : and(
              eq(sequences.status, 'sent'),
              sql`date(${sequences.sentAt}) = ${today}`
            )
      ),
    db.select({ c: count() })
      .from(leads)
      .where(
        filters?.excludeSeed
          ? and(
              inArray(leads.status, ['interested', 'booked']),
              not(sql`EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'leads' AND sr.record_id = CAST(${leads.id} AS TEXT))`)
            )
          : inArray(leads.status, ['interested', 'booked'])
      ),
  ]);

  return {
    posts_today: postsToday[0]?.c ?? 0,
    engagement_today: engagementToday[0]?.c ?? 0,
    emails_sent: emailsSent[0]?.c ?? 0,
    pipeline_count: pipelineCount[0]?.c ?? 0,
  };
}

export async function getAlerts(filters?: { excludeSeed?: boolean }): Promise<Alert[]> {
  const alerts: Alert[] = [];

  // Bounce rate check
  const metrics = await db.select({ sends: dailyMetrics.sends, bounces: dailyMetrics.bounces })
    .from(dailyMetrics)
    .orderBy(desc(dailyMetrics.date))
    .limit(1);
  
  if (metrics[0] && metrics[0].sends > 0 && (metrics[0].bounces / metrics[0].sends) > 0.03) {
    alerts.push({
      id: 'bounce-rate',
      type: 'error',
      message: `Bounce rate at ${((metrics[0].bounces / metrics[0].sends) * 100).toFixed(1)}% — exceeds 3% threshold`,
      created_at: new Date().toISOString(),
    });
  }

  // Pending approvals > 24h
  const stale = await db.select({ c: count() })
    .from(contentPosts)
    .where(
      filters?.excludeSeed
        ? and(
            eq(contentPosts.status, 'pending_approval'),
            lt(contentPosts.createdAt, sql`datetime('now', '-24 hours')`),
            not(sql`EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'content_posts' AND sr.record_id = CAST(${contentPosts.id} AS TEXT))`)
          )
        : and(
            eq(contentPosts.status, 'pending_approval'),
            lt(contentPosts.createdAt, sql`datetime('now', '-24 hours')`)
          )
    );
  if (stale[0]?.c > 0) {
    alerts.push({
      id: 'stale-approvals',
      type: 'warning',
      message: `${stale[0].c} content item(s) pending approval for >24 hours`,
      created_at: new Date().toISOString(),
    });
  }

  // Stale email approvals
  const staleEmails = await db.select({ c: count() })
    .from(sequences)
    .where(
      filters?.excludeSeed
        ? and(
            eq(sequences.status, 'pending_approval'),
            lt(sequences.createdAt, sql`datetime('now', '-24 hours')`),
            not(sql`EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'sequences' AND sr.record_id = CAST(${sequences.id} AS TEXT))`)
          )
        : and(
            eq(sequences.status, 'pending_approval'),
            lt(sequences.createdAt, sql`datetime('now', '-24 hours')`)
          )
    );
  if (staleEmails[0]?.c > 0) {
    alerts.push({
      id: 'stale-email-approvals',
      type: 'warning',
      message: `${staleEmails[0].c} email draft(s) pending approval for >24 hours`,
      created_at: new Date().toISOString(),
    });
  }

  // High engagement signal (viral)
  const viral = await db.select({ summary: signals.summary })
    .from(signals)
    .where(
      filters?.excludeSeed
        ? and(
            eq(signals.relevance, 'high'),
            sql`date(${signals.createdAt}) = date('now')`,
            not(sql`EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'signals' AND sr.record_id = CAST(${signals.id} AS TEXT))`)
          )
        : and(
            eq(signals.relevance, 'high'),
            sql`date(${signals.createdAt}) = date('now')`
          )
    )
    .orderBy(desc(signals.createdAt))
    .limit(1);
  
  if (viral[0]) {
    alerts.push({
      id: 'viral-signal',
      type: 'info',
      message: `High-relevance signal: ${viral[0].summary?.slice(0, 80)}...`,
      created_at: new Date().toISOString(),
    });
  }

  // Webhook-pushed notifications (unread, last 24h)
  const notifs = await db.select({
    id: notifications.id,
    severity: notifications.severity,
    title: notifications.title,
    message: notifications.message,
    createdAt: notifications.createdAt,
  })
    .from(notifications)
    .where(
      and(
        eq(notifications.read, false),
        gt(notifications.createdAt, sql`datetime('now', '-24 hours')`)
      )
    )
    .orderBy(desc(notifications.createdAt))
    .limit(10);

  for (const n of notifs) {
    alerts.push({
      id: `notif-${n.id}`,
      type: (n.severity === 'error' ? 'error' : n.severity === 'warning' ? 'warning' : 'info') as Alert['type'],
      message: n.title ? `${n.title}: ${n.message}` : n.message,
      created_at: n.createdAt.toISOString(),
    });
  }

  return alerts;
}

// ─── Content ───────────────────────────────────────────
export async function getContentPosts(filters?: {
  status?: string;
  platform?: string;
  pillar?: number;
  excludeSeed?: boolean;
}): Promise<ContentPost[]> {
  const conditions = [];
  
  if (filters?.status) conditions.push(eq(contentPosts.status, filters.status));
  if (filters?.platform) conditions.push(eq(contentPosts.platform, filters.platform));
  if (filters?.pillar) conditions.push(eq(contentPosts.pillar, filters.pillar));
  if (filters?.excludeSeed) {
    conditions.push(not(sql`EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'content_posts' AND sr.record_id = CAST(${contentPosts.id} AS TEXT))`));
  }

  const results = await db.select()
    .from(contentPosts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(contentPosts.createdAt));
  
  return toSnakeCaseArray(results) as unknown as ContentPost[];
}

export async function updateContentStatus(id: string, status: string): Promise<void> {
  await db.update(contentPosts)
    .set({ status })
    .where(eq(contentPosts.id, id));
}

// ─── Leads ─────────────────────────────────────────────
export async function getLeads(filters?: {
  status?: string;
  tier?: string;
  segment?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  excludeSeed?: boolean;
}): Promise<Lead[]> {
  const conditions = [];
  
  if (filters?.status) conditions.push(eq(leads.status, filters.status));
  if (filters?.tier) conditions.push(eq(leads.tier, filters.tier));
  if (filters?.segment) conditions.push(eq(leads.industrySegment, filters.segment));
  if (filters?.excludeSeed) {
    conditions.push(not(sql`EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'leads' AND sr.record_id = CAST(${leads.id} AS TEXT))`));
  }

  const sortCol = ['score', 'createdAt', 'lastTouchAt', 'company'].includes(filters?.sort || '')
    ? filters!.sort
    : 'createdAt';
  const order = filters?.order === 'asc' ? asc : desc;

  const orderByColumn = (() => {
    switch (sortCol) {
      case 'score': return leads.score;
      case 'createdAt': return leads.createdAt;
      case 'lastTouchAt': return leads.lastTouchAt;
      case 'company': return leads.company;
      default: return leads.createdAt;
    }
  })();

  const results = await db.select()
    .from(leads)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(order(orderByColumn));
  
  return toSnakeCaseArray(results) as unknown as Lead[];
}

export async function updateLeadStatus(id: string, status: string): Promise<void> {
  await db.update(leads)
    .set({ status, lastTouchAt: sql`datetime('now')` })
    .where(eq(leads.id, id));
}

export async function getLeadFunnel(filters?: { excludeSeed?: boolean }): Promise<FunnelStep[]> {
  const steps = ["new", "validated", "approved", "contacted", "replied", "interested", "booked", "qualified", "rejected", "disqualified"];
  
  const results = await Promise.all(
    steps.map(name => 
      db.select({ c: count() })
        .from(leads)
        .where(
          filters?.excludeSeed
            ? and(
                eq(leads.status, name),
                not(sql`EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'leads' AND sr.record_id = CAST(${leads.id} AS TEXT))`)
              )
            : eq(leads.status, name)
        )
    )
  );

  return steps.map((name, i) => ({
    name,
    value: results[i][0]?.c ?? 0,
  }));
}

// ─── Sequences ─────────────────────────────────────────
export async function getSequences(filters?: { status?: string; lead_id?: string; excludeSeed?: boolean }): Promise<Sequence[]> {
  const conditions = [];
  
  if (filters?.status) conditions.push(eq(sequences.status, filters.status));
  if (filters?.lead_id) conditions.push(eq(sequences.leadId, filters.lead_id));
  if (filters?.excludeSeed) {
    conditions.push(not(sql`EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'sequences' AND sr.record_id = CAST(${sequences.id} AS TEXT))`));
  }

  const results = await db.select()
    .from(sequences)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sequences.createdAt));
  
  return toSnakeCaseArray(results) as unknown as Sequence[];
}

export async function updateSequenceStatus(id: string, status: string): Promise<void> {
  await db.update(sequences)
    .set({ status })
    .where(eq(sequences.id, id));
}

// ─── Suppression ───────────────────────────────────────
export async function getSuppression(filters?: { excludeSeed?: boolean }): Promise<Suppression[]> {
  const conditions = [];
  if (filters?.excludeSeed) {
    conditions.push(not(sql`EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'suppression' AND sr.record_id = CAST(${suppression.email} AS TEXT))`));
  }

  const results = await db.select()
    .from(suppression)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(suppression.addedAt));
  
  return toSnakeCaseArray(results) as unknown as Suppression[];
}

// ─── Engagement ────────────────────────────────────────
export async function getEngagements(filters?: {
  platform?: string;
  action_type?: string;
  date?: string;
  excludeSeed?: boolean;
}): Promise<Engagement[]> {
  const conditions = [];
  
  if (filters?.platform) conditions.push(eq(engagements.platform, filters.platform));
  if (filters?.action_type) conditions.push(eq(engagements.actionType, filters.action_type));
  if (filters?.date) conditions.push(sql`date(${engagements.createdAt}) = ${filters.date}`);
  if (filters?.excludeSeed) {
    conditions.push(not(sql`EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'engagements' AND sr.record_id = CAST(${engagements.id} AS TEXT))`));
  }

  const results = await db.select()
    .from(engagements)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(engagements.createdAt))
    .limit(200);
  
  return toSnakeCaseArray(results) as unknown as Engagement[];
}

// ─── Signals ───────────────────────────────────────────
export async function getSignals(filters?: {
  type?: string;
  relevance?: string;
  date?: string;
  excludeSeed?: boolean;
}): Promise<Signal[]> {
  const conditions = [];
  
  if (filters?.type) conditions.push(eq(signals.type, filters.type));
  if (filters?.relevance) conditions.push(eq(signals.relevance, filters.relevance));
  if (filters?.date) conditions.push(eq(signals.date, filters.date));
  if (filters?.excludeSeed) {
    conditions.push(not(sql`EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'signals' AND sr.record_id = CAST(${signals.id} AS TEXT))`));
  }

  const results = await db.select()
    .from(signals)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(signals.createdAt))
    .limit(200);
  
  return toSnakeCaseArray(results) as unknown as Signal[];
}

// ─── Experiments ───────────────────────────────────────
export async function getExperiments(filters?: { status?: string; excludeSeed?: boolean }): Promise<Experiment[]> {
  const conditions = [];
  
  if (filters?.status) conditions.push(eq(experiments.status, filters.status));
  if (filters?.excludeSeed) {
    conditions.push(not(sql`EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'experiments' AND sr.record_id = CAST(${experiments.id} AS TEXT))`));
  }

  const results = await db.select()
    .from(experiments)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(experiments.week), desc(experiments.id));
  
  return toSnakeCaseArray(results) as unknown as Experiment[];
}

export async function getLearnings(filters?: { excludeSeed?: boolean }): Promise<Learning[]> {
  const conditions = [];
  if (filters?.excludeSeed) {
    conditions.push(not(sql`EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'learnings' AND sr.record_id = CAST(${learnings.id} AS TEXT))`));
  }

  const results = await db.select()
    .from(learnings)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(learnings.validatedWeek), desc(learnings.id));
  
  return toSnakeCaseArray(results) as unknown as Learning[];
}

// ─── KPIs ──────────────────────────────────────────────
export async function getDailyMetrics(days: number = 90, filters?: { excludeSeed?: boolean }): Promise<DailyMetrics[]> {
  const conditions = [];
  if (filters?.excludeSeed) {
    conditions.push(not(sql`EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'daily_metrics' AND sr.record_id = CAST(${dailyMetrics.date} AS TEXT))`));
  }

  const results = await db.select()
    .from(dailyMetrics)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(dailyMetrics.date))
    .limit(days);
  
  return toSnakeCaseArray(results) as unknown as DailyMetrics[];
}

export async function getWeeklyKPIs(weeks: number = 12, filters?: { excludeSeed?: boolean }): Promise<WeeklyKPI[]> {
  const conditions = [];
  if (filters?.excludeSeed) {
    conditions.push(not(sql`EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'daily_metrics' AND sr.record_id = CAST(${dailyMetrics.date} AS TEXT))`));
  }

  const metrics = await db.select()
    .from(dailyMetrics)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(dailyMetrics.date))
    .limit(weeks * 7);

  // Group by ISO week
  const weekMap = new Map<string, typeof metrics[0][]>();
  for (const m of metrics) {
    const d = new Date(m.date);
    const week = getISOWeek(d);
    const key = `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
    if (!weekMap.has(key)) weekMap.set(key, []);
    weekMap.get(key)!.push(m);
  }

  return Array.from(weekMap.entries()).map(([week, days]) => {
    const totalSends = days.reduce((s, d) => s + d.sends, 0);
    const totalReplies = days.reduce((s, d) => s + (d as unknown as { repliesTriaged: number }).repliesTriaged, 0);
    const totalImpressions = days.reduce((s, d) => s + (d as unknown as { totalImpressions: number }).totalImpressions, 0);
    const totalEngagement = days.reduce((s, d) => s + (d as unknown as { totalEngagement: number }).totalEngagement, 0);

    return {
      week,
      leads_added: days.reduce((s, d) => s + d.discoveries, 0),
      emails_sent: totalSends,
      reply_rate: totalSends > 0 ? (totalReplies / totalSends) * 100 : 0,
      positive_reply_rate: 0,
      calls_booked: 0,
      sqls: 0,
      impressions: totalImpressions,
      engagement_rate: totalImpressions > 0 ? (totalEngagement / totalImpressions) * 100 : 0,
    };
  }).slice(0, weeks);
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// ─── Activity Log ──────────────────────────────────────
export async function getActivityLog(filters?: {
  action?: string;
  limit?: number;
  excludeSeed?: boolean;
}): Promise<ActivityEntry[]> {
  const conditions = [];
  
  if (filters?.action) conditions.push(eq(activityLog.action, filters.action));
  if (filters?.excludeSeed) {
    conditions.push(not(sql`EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'activity_log' AND sr.record_id = CAST(${activityLog.id} AS TEXT))`));
  }

  const results = await db.select()
    .from(activityLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(activityLog.ts))
    .limit(filters?.limit ?? 100);
  
  return toSnakeCaseArray(results) as unknown as ActivityEntry[];
}

// ─── Notifications ────────────────────────────────────
export async function createNotification(data: {
  type: string;
  severity?: string;
  title?: string;
  message: string;
  data?: Record<string, unknown>;
}): Promise<number> {
  const result = await db.insert(notifications)
    .values({
      type: data.type,
      severity: data.severity || 'info',
      title: data.title || null,
      message: data.message,
      data: data.data ? JSON.stringify(data.data) : null,
    })
    .returning({ id: notifications.id });
  return result[0]?.id ?? 0;
}

export async function getNotifications(filters?: {
  unread_only?: boolean;
  type?: string;
  limit?: number;
}): Promise<NotificationType[]> {
  const conditions = [];
  
  if (filters?.unread_only) conditions.push(eq(notifications.read, false));
  if (filters?.type) conditions.push(eq(notifications.type, filters.type));

  const rows = await db.select()
    .from(notifications)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(notifications.createdAt))
    .limit(filters?.limit ?? 50);

  return toSnakeCaseArray(rows.map(r => ({
    ...r,
    read: r.read === true,
    data: r.data ? JSON.parse(r.data) : null,
  }))) as unknown as NotificationType[];
}

export async function markNotificationRead(id: number): Promise<void> {
  await db.update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, id));
}

export async function markAllNotificationsRead(): Promise<void> {
  await db.update(notifications)
    .set({ read: true })
    .where(eq(notifications.read, false));
}

// ─── Seed Registry ────────────────────────────────────────
export async function isSeedRecord(tableName: string, recordId: string): Promise<boolean> {
  const row = await db.select({ id: seedRegistry.tableName })
    .from(seedRegistry)
    .where(and(eq(seedRegistry.tableName, tableName), eq(seedRegistry.recordId, recordId)))
    .limit(1);
  return row.length > 0;
}

export async function getSeedCount(): Promise<number> {
  const result = await db.select({ c: count() }).from(seedRegistry);
  return result[0]?.c ?? 0;
}