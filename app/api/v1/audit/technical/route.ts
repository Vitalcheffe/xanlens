import { NextRequest, NextResponse } from "next/server";
import { runTechnicalAudit } from "@/app/lib/technical-audit";
import { getSearchInsights } from "@/app/lib/google-autocomplete";
import { redisSet } from "@/app/lib/redis";

export const maxDuration = 120; // Authority checks can take 60-90s

export async function GET(req: NextRequest) {
  const website = req.nextUrl.searchParams.get("url");
  const brand = req.nextUrl.searchParams.get("brand") || "";
  const industry = req.nextUrl.searchParams.get("industry") || "";
  const description = req.nextUrl.searchParams.get("description") || "";
  // When jobId is provided, this endpoint writes its own results to Redis
  // (used by /audit/run fire-and-forget pattern — worker owns its own persistence)
  const jobId = req.nextUrl.searchParams.get("jobId") || "";

  if (!website) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(website.startsWith("http") ? website : `https://${website}`);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const fullUrl = parsedUrl.toString();
  const googleApiKey = process.env.GOOGLE_API_KEY;

  // Extract clean brand name from hostname if not provided (e.g., "coinbase.com" → "Coinbase")
  const inferredBrand = brand || (() => {
    const name = parsedUrl.hostname.replace(/^www\./, "").split(".")[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  })();

  const sideTTL = 90 * 24 * 3600; // match /run TTL

  try {
    // Run technical audit + search insights in parallel
    const [technical, searchInsights] = await Promise.all([
      runTechnicalAudit(fullUrl, inferredBrand, googleApiKey, industry, description),
      getSearchInsights(inferredBrand, industry),
    ]);

    const result = {
      ...technical,
      search_insights: searchInsights,
      status: "complete",
      completedAt: Date.now(),
    };

    // If jobId provided, persist to Redis (worker owns its own output)
    if (jobId) {
      await redisSet(`audit:${jobId}:side:technical`, JSON.stringify(result), sideTTL);
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: unknown) {
    // If jobId provided, persist error state so downstream knows it failed (not "pending")
    if (jobId) {
      await redisSet(`audit:${jobId}:side:technical`, JSON.stringify({
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
        failedAt: Date.now(),
      }), sideTTL).catch(() => {});
    }

    return NextResponse.json(
      { error: "Technical audit failed", message: (err instanceof Error ? err.message : "Unknown error") },
      { status: 502 }
    );
  }
}
