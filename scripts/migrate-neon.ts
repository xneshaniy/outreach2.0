#!/usr/bin/env tsx
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import * as schema from '../src/lib/schema';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
  console.log('Running migrations on Neon...');
  
  // Create all tables
  await sql`
    CREATE TABLE IF NOT EXISTS content_posts (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      format TEXT NOT NULL,
      pillar INTEGER,
      text_preview TEXT,
      full_content TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      scheduled_for TIMESTAMP,
      published_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      impressions INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0,
      replies INTEGER DEFAULT 0,
      reposts INTEGER DEFAULT 0,
      saves INTEGER DEFAULT 0,
      engagement_rate REAL DEFAULT 0,
      image_url TEXT
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      title TEXT,
      company TEXT,
      company_size TEXT,
      industry_segment TEXT,
      source TEXT,
      email TEXT,
      linkedin_url TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      score INTEGER,
      tier TEXT,
      last_touch_at TIMESTAMP,
      next_action_at TIMESTAMP,
      sequence_name TEXT,
      reply_type TEXT,
      notes TEXT,
      pause_outreach INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sequences (
      id TEXT PRIMARY KEY,
      lead_id TEXT REFERENCES leads(id),
      sequence_name TEXT,
      step INTEGER,
      subject TEXT,
      body TEXT,
      status TEXT,
      tier TEXT,
      scheduled_for TIMESTAMP,
      sent_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS suppression (
      email TEXT PRIMARY KEY,
      type TEXT,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS engagements (
      id SERIAL PRIMARY KEY,
      platform TEXT,
      action_type TEXT,
      target_url TEXT,
      target_username TEXT,
      our_text TEXT,
      status TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS signals (
      id SERIAL PRIMARY KEY,
      date TEXT,
      type TEXT,
      username TEXT,
      tweet_url TEXT,
      summary TEXT,
      relevance TEXT,
      action_taken TEXT,
      likes INTEGER,
      impressions INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS experiments (
      id SERIAL PRIMARY KEY,
      week INTEGER,
      hypothesis TEXT,
      action TEXT,
      metric TEXT,
      win_threshold TEXT,
      status TEXT,
      results TEXT,
      winner TEXT,
      margin TEXT,
      decision TEXT,
      learning TEXT,
      next_action TEXT,
      proposed_at TIMESTAMP,
      completed_at TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS learnings (
      id SERIAL PRIMARY KEY,
      learning TEXT,
      validated_week INTEGER,
      confidence TEXT,
      applied_to TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS daily_metrics (
      date TEXT PRIMARY KEY,
      x_posts INTEGER DEFAULT 0,
      x_threads INTEGER DEFAULT 0,
      linkedin_drafts INTEGER DEFAULT 0,
      x_replies INTEGER DEFAULT 0,
      x_quote_tweets INTEGER DEFAULT 0,
      x_follows INTEGER DEFAULT 0,
      linkedin_comments INTEGER DEFAULT 0,
      discoveries INTEGER DEFAULT 0,
      enrichments INTEGER DEFAULT 0,
      sends INTEGER DEFAULT 0,
      replies_triaged INTEGER DEFAULT 0,
      opt_outs INTEGER DEFAULT 0,
      bounces INTEGER DEFAULT 0,
      total_impressions INTEGER DEFAULT 0,
      total_engagement INTEGER DEFAULT 0
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      ts TIMESTAMP,
      action TEXT,
      detail TEXT,
      result TEXT
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      title TEXT,
      message TEXT NOT NULL,
      data TEXT,
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS seed_registry (
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      PRIMARY KEY (table_name, record_id)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      from_agent TEXT NOT NULL,
      to_agent TEXT,
      content TEXT NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'text',
      metadata TEXT,
      read_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT 0
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS session_sync (
      session_file TEXT PRIMARY KEY,
      last_offset INTEGER NOT NULL DEFAULT 0,
      last_synced_at INTEGER
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS llm_usage_events (
      id SERIAL PRIMARY KEY,
      day TEXT NOT NULL,
      agent_id TEXT,
      model TEXT,
      total_tokens INTEGER DEFAULT 0,
      cost_usd REAL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      email TEXT UNIQUE,
      auth_provider TEXT NOT NULL DEFAULT 'local',
      google_sub TEXT UNIQUE
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      user_id INTEGER REFERENCES users(id),
      expires_at INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS google_login_requests (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      google_sub TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_role TEXT NOT NULL DEFAULT 'viewer',
      attempts INTEGER NOT NULL DEFAULT 1,
      last_error TEXT,
      last_attempt_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TIMESTAMP
    );
  `;

  // Create indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_content_status ON content_posts(status);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_content_platform ON content_posts(platform);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_leads_tier ON leads(tier);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sequences_status ON sequences(status);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sequences_lead ON sequences(lead_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_engagements_platform ON engagements(platform);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_signals_type ON signals(type);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_signals_date ON signals(date);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_log(action);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity_log(ts);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_agents ON messages(from_agent, to_agent);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_llm_usage_day ON llm_usage_events(day);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_llm_usage_agent ON llm_usage_events(agent_id, day);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_google_login_requests_status ON google_login_requests(status);`;

  console.log('Migrations completed successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});