import { NextRequest, NextResponse } from "next/server";
import { redisSet } from "@/app/lib/redis";

export const runtime = "nodejs";

// Admin secret — must match ADMIN_SECRET env var
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    console.error("ADMIN_SECRET not set in environment");
    return false;
  }
  const auth = req.headers.get("Authorization");
  return auth === `Bearer ${secret}`;
}

// Generate a readable coupon code like "GEO-ABCD-1234"
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
  const seg1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const seg2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `GEO-${seg1}-${seg2}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const count = Math.min(Math.max(body.count || 20, 1), 100); // 1-100 codes
  const ttlHours = body.ttlHours ?? 48; // 0 = no expiration
  const maxUses = body.maxUses || 0; // 0 = unlimited uses
  const campaign = body.campaign || "social";
  const ttl = ttlHours > 0 ? ttlHours * 3600 : 0; // 0 = permanent

  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = generateCode();
    await redisSet(`coupon:${code}`, JSON.stringify({
      status: "active",
      campaign,
      maxUses,
      usedCount: 0,
      createdAt: Date.now(),
      expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : null,
    }), ttl); // ttl=0 means no expiration in Redis
    codes.push(code);
  }

  // Store batch metadata for tracking
  const batchId = `batch-${Date.now()}`;
  await redisSet(`coupon:batch:${batchId}`, JSON.stringify({
    codes,
    campaign,
    count,
    ttlHours: ttlHours || "unlimited",
    maxUses: maxUses || "unlimited",
    createdAt: Date.now(),
  }), ttl);

  return NextResponse.json({
    ok: true,
    batch: batchId,
    count,
    ttlHours,
    campaign,
    codes,
  });
}
