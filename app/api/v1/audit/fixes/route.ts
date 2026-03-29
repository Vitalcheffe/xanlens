import { NextRequest, NextResponse } from "next/server";
import { redisGet, redisSet } from "@/app/lib/redis";

export const runtime = "nodejs";

// Redis TTL command (not in shared lib, inline here)
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

interface Fix {
  id: string;
  title: string;
  type: "on-site" | "off-site";
  platform: string;
  description: string;
  content: string;
  priority: number;
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  const raw = await redisGet(`audit:${jobId}:fixes`);
  if (!raw) return NextResponse.json({ fixes: [] });

  try {
    const fixes: Fix[] = JSON.parse(raw);
    return NextResponse.json({ fixes });
  } catch {
    return NextResponse.json({ fixes: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, fixes } = body;

    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json({ error: "Missing or invalid jobId" }, { status: 400 });
    }
    if (!Array.isArray(fixes) || fixes.length === 0) {
      return NextResponse.json({ error: "Missing or empty fixes array" }, { status: 400 });
    }

    // Validate job exists
    const meta = await redisGet(`audit:${jobId}:meta`);
    if (!meta) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Match TTL from meta key
    const ttl = await redisTtl(`audit:${jobId}:meta`);
    const effectiveTtl = ttl > 0 ? ttl : 7 * 24 * 3600; // fallback 7 days

    await redisSet(`audit:${jobId}:fixes`, JSON.stringify(fixes), effectiveTtl);

    return NextResponse.json({ ok: true, count: fixes.length });
  } catch (e) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
