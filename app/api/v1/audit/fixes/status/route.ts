import { NextRequest, NextResponse } from "next/server";
import { redisGet, redisSet } from "@/app/lib/redis";

export const runtime = "nodejs";

async function redisTtl(key: string): Promise<number> {
  const KV_URL = process.env.KV_REST_API_URL || "";
  const KV_TOKEN = process.env.KV_REST_API_TOKEN || "";
  const res = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(["TTL", key]),
  });
  const data = await res.json();
  return data.result ?? -1;
}

const VALID_STATUSES = ["approved", "rejected", "published", "suggestion"] as const;

export async function POST(req: NextRequest) {
  try {
    const { jobId, fixId, status, suggestion } = await req.json();

    if (!jobId || typeof jobId !== "string")
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    if (!fixId || typeof fixId !== "string")
      return NextResponse.json({ error: "Missing fixId" }, { status: 400 });
    if (!VALID_STATUSES.includes(status))
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });

    const key = `audit:${jobId}:fixes`;
    const raw = await redisGet(key);
    if (!raw)
      return NextResponse.json({ error: "Fixes not found" }, { status: 404 });

    const fixes = JSON.parse(raw);
    const fix = fixes.find((f: { id: string }) => f.id === fixId);
    if (!fix)
      return NextResponse.json({ error: "Fix not found" }, { status: 404 });

    if (status === "suggestion") {
      // Store suggestion without changing status
      if (!fix.suggestions) fix.suggestions = [];
      fix.suggestions.push({ text: suggestion || "", timestamp: new Date().toISOString() });
    } else {
      fix.status = status;
    }

    const ttl = await redisTtl(`audit:${jobId}:meta`);
    const effectiveTtl = ttl > 0 ? ttl : 7 * 24 * 3600;

    await redisSet(key, JSON.stringify(fixes), effectiveTtl);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
