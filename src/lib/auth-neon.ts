import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { db } from './db-neon';
import { users, sessions, googleLoginRequests } from './schema';
import { eq, and, desc, sql, gt, lt } from 'drizzle-orm';

const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const SCRYPT_COST = 16384;
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days

export interface User {
  id: number;
  username: string;
  role: string;
  created_at: string;
  email?: string | null;
  auth_provider?: string | null;
}

export interface UserRecord extends User {
  password_hash: string;
}

export type UserRole = 'admin' | 'editor' | 'viewer';
export type AuthProvider = 'local' | 'google';
export type LoginRequestStatus = 'pending' | 'approved' | 'denied';

export interface GoogleLoginRequest {
  id: number;
  email: string;
  google_sub?: string | null;
  status: LoginRequestStatus;
  requested_role: UserRole;
  attempts: number;
  last_error?: string | null;
  last_attempt_at: string;
  created_at: string;
  updated_at: string;
  reviewed_at?: string | null;
}

type UserRoleInput = UserRole | 'operator';

function normalizeRole(value: string): UserRole {
  if (value === 'operator') return 'editor';
  if (value === 'admin' || value === 'editor' || value === 'viewer') return value;
  return 'viewer';
}

function normalizeRoleInput(value: UserRoleInput): UserRole {
  return normalizeRole(value);
}

function normalizeRoleValue(value: unknown, fallback: UserRole = 'viewer'): UserRole {
  if (typeof value !== 'string') return fallback;
  return normalizeRole(value);
}

function requireEnv(name: 'AUTH_USER' | 'AUTH_PASS'): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be set`);
  }
  return value;
}

export function getConfiguredApiKey(): string | null {
  const value = process.env.API_KEY?.trim();
  return value ? value : null;
}

function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_COST }).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_COST });
  const storedBuf = Buffer.from(hash, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return timingSafeEqual(derived, storedBuf);
}

export async function ensureAuthTables(): Promise<void> {
  // Tables are created via Drizzle migrations, this is a no-op for Neon
  // but kept for API compatibility
}

export async function seedAdmin(): Promise<void> {
  await ensureAuthTables();
  const existingUsers = await db.select({ id: users.id }).from(users).limit(1);
  if (existingUsers.length > 0) return;

  const username = requireEnv('AUTH_USER').toLowerCase();
  const password = requireEnv('AUTH_PASS');
  if (username.length < 3) {
    throw new Error('AUTH_USER must be at least 3 characters');
  }
  if (password.length < 10) {
    throw new Error('AUTH_PASS must be at least 10 characters');
  }
  await db.insert(users).values({
    username,
    passwordHash: hashPassword(password),
    role: 'admin',
  });
}

export async function authenticate(username: string, password: string): Promise<User | null> {
  const row = await db.select()
    .from(users)
    .where(eq(users.username, username.trim().toLowerCase()))
    .limit(1);
  
  const userRow = row[0];
  if (!userRow || !verifyPassword(password, userRow.passwordHash)) return null;
  
  const userRecord: UserRecord = {
    id: userRow.id,
    username: userRow.username,
    role: userRow.role,
    created_at: userRow.createdAt.toISOString(),
    email: userRow.email ?? null,
    auth_provider: userRow.authProvider ?? 'local',
    password_hash: userRow.passwordHash,
  };
  
  return {
    id: userRecord.id,
    username: userRecord.username,
    role: normalizeRole(userRecord.role),
    created_at: userRecord.created_at,
    email: userRecord.email ?? null,
    auth_provider: userRecord.auth_provider ?? 'local',
  };
}

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION;
  await db.insert(sessions).values({
    token,
    userId,
    expiresAt,
  });
  // Clean expired sessions
  await db.delete(sessions).where(lt(sessions.expiresAt, Math.floor(Date.now() / 1000)));
  return token;
}

export async function validateSession(token: string): Promise<User | null> {
  if (!token) return null;
  const now = Math.floor(Date.now() / 1000);
  
  const result = await db.select({
    id: users.id,
    username: users.username,
    role: users.role,
    createdAt: users.createdAt,
    email: users.email,
    authProvider: users.authProvider,
  })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, now)))
    .limit(1);
  
  const row = result[0];
  if (!row) return null;
  
  return { 
    ...row, 
    role: normalizeRole(row.role),
    created_at: row.createdAt.toISOString(),
  };
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function listUsers(): Promise<User[]> {
  await ensureAuthTables();
  const rows = await db.select({
    id: users.id,
    username: users.username,
    role: users.role,
    createdAt: users.createdAt,
    email: users.email,
    authProvider: users.authProvider,
  })
    .from(users)
    .orderBy(users.id);
  
  return rows.map((row) => ({ 
    ...row, 
    role: normalizeRole(row.role),
    created_at: row.createdAt.toISOString(),
  }));
}

export async function createUser(username: string, password: string, role: UserRoleInput = 'editor'): Promise<User> {
  await ensureAuthTables();
  const normalized = username.trim().toLowerCase();
  if (!normalized || normalized.length < 3) {
    throw new Error('Username must be at least 3 characters');
  }
  if (!password || password.length < 10) {
    throw new Error('Password must be at least 10 characters');
  }
  if (!['admin', 'editor', 'viewer', 'operator'].includes(role)) {
    throw new Error('Invalid role');
  }
  const normalizedRole = normalizeRoleInput(role);
  
  await db.insert(users).values({
    username: normalized,
    passwordHash: hashPassword(password),
    role: normalizedRole,
  });
  
  const row = await db.select({
    id: users.id,
    username: users.username,
    role: users.role,
    createdAt: users.createdAt,
    email: users.email,
    authProvider: users.authProvider,
  })
    .from(users)
    .where(eq(users.username, normalized))
    .limit(1);
  
  const user = row[0];
  return { ...user, role: normalizeRole(user.role), created_at: user.createdAt.toISOString() };
}

function parseAllowedList(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

async function ensureGoogleAllowed(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const dbRule = await db.select({ status: googleLoginRequests.status })
    .from(googleLoginRequests)
    .where(eq(googleLoginRequests.email, normalizedEmail))
    .limit(1);
  
  const rule = dbRule[0];
  if (rule?.status === 'approved') return;
  if (rule?.status === 'denied') {
    throw new Error('Google account access denied by admin');
  }
  if (rule?.status === 'pending') {
    throw new Error('Access request pending admin approval');
  }

  const allowedEmails = parseAllowedList(process.env.GOOGLE_AUTH_ALLOWED_EMAILS);
  const allowedDomains = parseAllowedList(process.env.GOOGLE_AUTH_ALLOWED_DOMAINS);

  if (allowedEmails.length === 0 && allowedDomains.length === 0) return;

  if (allowedEmails.includes(normalizedEmail)) return;

  const at = normalizedEmail.lastIndexOf('@');
  const domain = at >= 0 ? normalizedEmail.slice(at + 1) : '';
  if (domain && allowedDomains.includes(domain)) return;

  throw new Error('Google account is not allowed; request pending admin approval');
}

function getGoogleDefaultRole(): UserRole {
  const raw = (process.env.GOOGLE_AUTH_DEFAULT_ROLE || 'viewer').trim().toLowerCase();
  return normalizeRole(raw);
}

async function getApprovedRequestedRole(email: string): Promise<UserRole | null> {
  const row = await db.select({ requestedRole: googleLoginRequests.requestedRole })
    .from(googleLoginRequests)
    .where(and(eq(googleLoginRequests.email, email), eq(googleLoginRequests.status, 'approved')))
    .limit(1);
  if (!row[0]) return null;
  return normalizeRoleValue(row[0].requestedRole, getGoogleDefaultRole());
}

function makeUsernameFromEmail(email: string): string {
  const base = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 24);
  return base.length >= 3 ? base : `user${Math.floor(Math.random() * 9000 + 1000)}`;
}

async function uniqueUsername(base: string): Promise<string> {
  const normalizedBase = base.trim().toLowerCase();
  let candidate = normalizedBase;
  let n = 1;
  while (true) {
    const existing = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.username, candidate))
      .limit(1);
    if (existing.length === 0) break;
    n += 1;
    candidate = `${normalizedBase}${n}`;
  }
  return candidate;
}

export async function upsertGoogleUser(googleSub: string, email: string): Promise<User> {
  await ensureAuthTables();
  if (!googleSub?.trim()) throw new Error('Missing Google subject');
  if (!email?.trim()) throw new Error('Missing Google email');

  const normalizedEmail = email.trim().toLowerCase();
  await ensureGoogleAllowed(normalizedEmail);

  // Prefer existing link by Google subject.
  const bySub = await db.select({
    id: users.id,
    username: users.username,
    role: users.role,
    createdAt: users.createdAt,
    email: users.email,
    authProvider: users.authProvider,
  })
    .from(users)
    .where(eq(users.googleSub, googleSub))
    .limit(1);
  
  if (bySub[0]) return { ...bySub[0], role: normalizeRole(bySub[0].role), created_at: bySub[0].createdAt.toISOString() };

  // Link existing account by email if present.
  const byEmail = await db.select({
    id: users.id,
    username: users.username,
    role: users.role,
    createdAt: users.createdAt,
    email: users.email,
    authProvider: users.authProvider,
  })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);
  
  if (byEmail[0]) {
    await db.update(users)
      .set({ googleSub, authProvider: 'google' })
      .where(eq(users.id, byEmail[0].id));
    
    const row = await db.select({
      id: users.id,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
      email: users.email,
      authProvider: users.authProvider,
    })
      .from(users)
      .where(eq(users.id, byEmail[0].id))
      .limit(1);
    
    return { ...row[0], role: normalizeRole(row[0].role), created_at: row[0].createdAt.toISOString() };
  }

  const role = await getApprovedRequestedRole(normalizedEmail) ?? getGoogleDefaultRole();
  const username = await uniqueUsername(makeUsernameFromEmail(normalizedEmail));
  const pseudoPassword = randomBytes(24).toString('hex');
  
  await db.insert(users).values({
    username,
    passwordHash: hashPassword(pseudoPassword),
    role,
    email: normalizedEmail,
    authProvider: 'google',
    googleSub,
  });

  const row = await db.select({
    id: users.id,
    username: users.username,
    role: users.role,
    createdAt: users.createdAt,
    email: users.email,
    authProvider: users.authProvider,
  })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  
  return { ...row[0], role: normalizeRole(row[0].role), created_at: row[0].createdAt.toISOString() };
}

export async function recordGoogleLoginAttempt(email: string, googleSub: string | null, reason: string): Promise<void> {
  await ensureAuthTables();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;

  await db.insert(googleLoginRequests).values({
    email: normalizedEmail,
    googleSub,
    status: 'pending',
    requestedRole: getGoogleDefaultRole(),
    attempts: 1,
    lastError: reason,
    lastAttemptAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: googleLoginRequests.email,
    set: {
      googleSub: sql`COALESCE(EXCLUDED.${googleLoginRequests.googleSub}, ${googleLoginRequests.googleSub})`,
      attempts: sql`${googleLoginRequests.attempts} + 1`,
      lastError: reason,
      lastAttemptAt: new Date(),
      status: sql`CASE 
        WHEN ${googleLoginRequests.status} = 'approved' THEN 'approved'
        WHEN ${googleLoginRequests.status} = 'denied' THEN 'denied'
        ELSE 'pending'
      END`,
      updatedAt: new Date(),
    },
  });
}

export async function listGoogleLoginRequests(): Promise<GoogleLoginRequest[]> {
  await ensureAuthTables();
  const rows = await db.select({
    id: googleLoginRequests.id,
    email: googleLoginRequests.email,
    googleSub: googleLoginRequests.googleSub,
    status: googleLoginRequests.status,
    requestedRole: googleLoginRequests.requestedRole,
    attempts: googleLoginRequests.attempts,
    lastError: googleLoginRequests.lastError,
    lastAttemptAt: googleLoginRequests.lastAttemptAt,
    createdAt: googleLoginRequests.createdAt,
    updatedAt: googleLoginRequests.updatedAt,
    reviewedAt: googleLoginRequests.reviewedAt,
  })
    .from(googleLoginRequests)
    .orderBy(
      sql`CASE ${googleLoginRequests.status} WHEN 'pending' THEN 0 WHEN 'denied' THEN 1 ELSE 2 END`,
      desc(googleLoginRequests.lastAttemptAt)
    );

  return rows.map((row) => ({
    ...row,
    status: (row.status === 'approved' || row.status === 'denied' || row.status === 'pending') ? row.status : 'pending',
    requested_role: normalizeRoleValue(row.requestedRole),
    last_attempt_at: row.lastAttemptAt.toISOString(),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    reviewed_at: row.reviewedAt?.toISOString(),
  }));
}

export async function reviewGoogleLoginRequest(email: string, action: 'approve' | 'deny', role: UserRole = 'viewer'): Promise<void> {
  await ensureAuthTables();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Email is required');

  if (action === 'approve') {
    const approvedRole = normalizeRoleValue(role, 'viewer');
    await db.transaction(async (tx) => {
      await tx.insert(googleLoginRequests).values({
        email: normalizedEmail,
        status: 'approved',
        requestedRole: approvedRole,
        attempts: 0,
        lastError: null,
        lastAttemptAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        reviewedAt: new Date(),
      }).onConflictDoUpdate({
        target: googleLoginRequests.email,
        set: {
          status: 'approved',
          requestedRole: approvedRole,
          attempts: 0,
          lastError: null,
          updatedAt: new Date(),
          reviewedAt: new Date(),
        },
      });
      await tx.update(users).set({ role: approvedRole }).where(eq(users.email, normalizedEmail));
    });
    return;
  }

  await db.insert(googleLoginRequests).values({
    email: normalizedEmail,
    status: 'denied',
    requestedRole: normalizeRoleValue(role, 'viewer'),
    attempts: 0,
    lastError: null,
    lastAttemptAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    reviewedAt: new Date(),
  }).onConflictDoUpdate({
    target: googleLoginRequests.email,
    set: {
      status: 'denied',
      requestedRole: normalizeRoleValue(role, 'viewer'),
      attempts: 0,
      lastError: null,
      updatedAt: new Date(),
      reviewedAt: new Date(),
    },
  });
}

export async function updateUserRole(userId: number, role: UserRoleInput): Promise<void> {
  if (!['admin', 'editor', 'viewer', 'operator'].includes(role)) {
    throw new Error('Invalid role');
  }
  const normalizedRole = normalizeRoleInput(role);
  await db.update(users).set({ role: normalizedRole }).where(eq(users.id, userId));
}

export async function resetUserPassword(userId: number, password: string): Promise<void> {
  if (!password || password.length < 10) {
    throw new Error('Password must be at least 10 characters');
  }
  await db.update(users)
    .set({ passwordHash: hashPassword(password) })
    .where(eq(users.id, userId));
}

export async function deleteUser(userId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(users).where(eq(users.id, userId));
  });
}

export async function getUserFromRequest(request: Request): Promise<User | null> {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/(?:^|;\s*)hermes-session=([^;]*)/);
  const token = match ? decodeURIComponent(match[1]) : null;
  if (token) {
    const user = await validateSession(token);
    if (user) return user;
  }

  const apiKey = request.headers.get('x-api-key');
  const configuredApiKey = getConfiguredApiKey();
  if (apiKey && configuredApiKey && apiKey === configuredApiKey) {
    return { id: 0, username: 'api', role: 'admin', created_at: '' };
  }

  return null;
}

export async function requireUser(request: Request): Promise<User> {
  const user = await getUserFromRequest(request);
  if (!user) {
    throw new Error('unauthorized');
  }
  return user;
}

export async function requireAdmin(request: Request): Promise<User> {
  const user = await requireUser(request);
  if (user.role !== 'admin') {
    throw new Error('forbidden');
  }
  return user;
}