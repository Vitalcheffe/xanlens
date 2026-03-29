// Auth utilities — user account management via Redis
// Users are identified by their Coinbase wallet address (EVM)

import { redisGet, redisSet } from "./redis";

export interface UserAccount {
  wallet: string;          // EVM address (primary key)
  email?: string;          // optional, from CDP auth
  createdAt: number;
  lastLoginAt: number;
  totalAudits: number;
  isAgent: boolean;        // true if created via API (no human auth)
}

export interface AuditRecord {
  jobId: string;
  brand: string;
  industry: string;
  website?: string;
  tier: "free" | "pro" | "coupon";
  createdAt: number;
  status: "processing" | "complete" | "failed";
  score?: number;
  revenueEstimate?: string;
}

const USER_PREFIX = "user:";
const AUDITS_PREFIX = "user:audits:";
const SESSION_PREFIX = "session:";       // session:<token> → wallet
const WALLET_SESSION_PREFIX = "wallet:session:"; // wallet:session:<wallet> → token

export async function getUser(wallet: string): Promise<UserAccount | null> {
  const data = await redisGet(`${USER_PREFIX}${wallet.toLowerCase()}`);
  if (!data) return null;
  return JSON.parse(data);
}

export async function createUser(wallet: string, opts?: { email?: string; isAgent?: boolean }): Promise<UserAccount> {
  const existing = await getUser(wallet);
  if (existing) {
    // Update last login
    existing.lastLoginAt = Date.now();
    await redisSet(`${USER_PREFIX}${wallet.toLowerCase()}`, JSON.stringify(existing));
    return existing;
  }

  const user: UserAccount = {
    wallet: wallet.toLowerCase(),
    email: opts?.email,
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
    totalAudits: 0,
    isAgent: opts?.isAgent || false,
  };

  await redisSet(`${USER_PREFIX}${wallet.toLowerCase()}`, JSON.stringify(user));
  return user;
}

export async function addAuditToHistory(wallet: string, record: AuditRecord): Promise<void> {
  const key = `${AUDITS_PREFIX}${wallet.toLowerCase()}`;
  const existing = await redisGet(key);
  const audits: AuditRecord[] = existing ? JSON.parse(existing) : [];
  audits.unshift(record); // newest first
  // Keep max 100 records
  if (audits.length > 100) audits.length = 100;
  await redisSet(key, JSON.stringify(audits));

  // Update user audit count
  const user = await getUser(wallet);
  if (user) {
    user.totalAudits = audits.length;
    await redisSet(`${USER_PREFIX}${wallet.toLowerCase()}`, JSON.stringify(user));
  }
}

export async function getAuditHistory(wallet: string): Promise<AuditRecord[]> {
  const key = `${AUDITS_PREFIX}${wallet.toLowerCase()}`;
  const data = await redisGet(key);
  if (!data) return [];
  return JSON.parse(data);
}

export async function updateAuditStatus(wallet: string, jobId: string, status: "complete" | "failed", score?: number): Promise<void> {
  const key = `${AUDITS_PREFIX}${wallet.toLowerCase()}`;
  const existing = await redisGet(key);
  if (!existing) return;
  const audits: AuditRecord[] = JSON.parse(existing);
  const audit = audits.find(a => a.jobId === jobId);
  if (audit) {
    audit.status = status;
    if (score !== undefined) audit.score = score;
    await redisSet(key, JSON.stringify(audits));
  }
}

// ── Session tokens ──
// Persistent access tokens that map to a wallet — lets agents/users access
// full audit history without connecting a wallet in the browser.

export async function getOrCreateSessionToken(wallet: string): Promise<string> {
  const w = wallet.toLowerCase();
  // Check if wallet already has a session token
  const existing = await redisGet(`${WALLET_SESSION_PREFIX}${w}`);
  if (existing) return existing;

  // Create new token
  const token = crypto.randomUUID();
  // Store both directions — no TTL (permanent)
  await redisSet(`${SESSION_PREFIX}${token}`, w, 0);
  await redisSet(`${WALLET_SESSION_PREFIX}${w}`, token, 0);
  return token;
}

export async function getWalletBySessionToken(token: string): Promise<string | null> {
  const wallet = await redisGet(`${SESSION_PREFIX}${token}`);
  return wallet || null;
}

export async function revokeSessionToken(wallet: string): Promise<void> {
  const w = wallet.toLowerCase();
  const token = await redisGet(`${WALLET_SESSION_PREFIX}${w}`);
  if (token) {
    await redisSet(`${SESSION_PREFIX}${token}`, "", 1); // expire in 1s
    await redisSet(`${WALLET_SESSION_PREFIX}${w}`, "", 1);
  }
}

// tier removed — pay-per-audit model, no account tiers
