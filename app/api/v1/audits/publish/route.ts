import { NextRequest, NextResponse } from "next/server";

const KV_URL = process.env.KV_REST_API_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || "";

async function kvRun(cmd: string[]) {
  const res = await fetch(`${KV_URL}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  const validKeys = [
    process.env.XANOS_API_KEY,
  ].filter(Boolean);
  if (!auth || !validKeys.includes(auth)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId, action } = await req.json();
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  if (action === "unpublish") {
    await kvRun(["SREM", "geo-index:published", jobId]);
    return NextResponse.json({ ok: true, action: "unpublished", jobId });
  }

  // Default: publish
  await kvRun(["SADD", "geo-index:published", jobId]);
  return NextResponse.json({ ok: true, action: "published", jobId });
}

export async function GET() {
  const res = await fetch(`${KV_URL}/smembers/geo-index:published`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) return NextResponse.json({ published: [] });
  const data = await res.json();
  return NextResponse.json({ published: data.result || [] });
}
