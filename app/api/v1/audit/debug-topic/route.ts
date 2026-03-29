import { NextRequest, NextResponse } from "next/server";
import { redisGet } from "@/app/lib/redis";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    // KILL SWITCH
    const ENABLED = true;
    if (!ENABLED) return NextResponse.json({ error: "Temporarily disabled.", status: "maintenance" }, { status: 503 });
    const { response, keywords, brand } = await request.json();
    const { analyzeMentions } = await import("@/app/lib/mention-analyzer");
    const analysis = analyzeMentions(response, brand, undefined, "test prompt", keywords);
    return NextResponse.json({
      genuine: analysis.genuine,
      mentions: analysis.mentions,
      sentiment: analysis.sentiment,
      // _debug_topic removed — LLM judge handles wrong-entity detection
      snippets: analysis.snippets,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET: inspect audit meta from Redis
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId required" });
  const metaRaw = await redisGet(`audit:${jobId}:meta`);
  if (!metaRaw) return NextResponse.json({ error: "not found" });
  const meta = JSON.parse(metaRaw);
  return NextResponse.json({
    brand: meta.brand,
    keywords: meta.keywords,
    features: meta.features,
    keywordsLength: (meta.keywords || []).length,
    featuresLength: (meta.features || []).length,
  });
}
