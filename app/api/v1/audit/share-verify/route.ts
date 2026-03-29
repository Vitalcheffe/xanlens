import { NextRequest, NextResponse } from "next/server";
import { redisGet, redisSet } from "@/app/lib/redis";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

/**
 * POST /api/v1/audit/share-verify
 * 
 * Verifies a tweet URL mentions @xanlens_ and generates a free re-audit coupon.
 * No admin secret needed — agent calls this after human shares.
 * 
 * Body: { "jobId": "...", "tweetUrl": "..." }
 * Returns: { "ok": true, "coupon": "GEO-XXXX-XXXX" }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, tweetUrl } = body;

    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }
    if (!tweetUrl || typeof tweetUrl !== "string") {
      return NextResponse.json({ error: "Missing tweetUrl" }, { status: 400 });
    }

    // Validate tweet URL format
    const tweetUrlLower = tweetUrl.toLowerCase();
    if (!tweetUrlLower.includes("x.com/") && !tweetUrlLower.includes("twitter.com/")) {
      return NextResponse.json({ error: "Invalid tweet URL — must be an x.com or twitter.com link" }, { status: 400 });
    }

    // Check job exists
    const meta = await redisGet(`audit:${jobId}:meta`);
    if (!meta) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    // Check if already shared (one coupon per audit)
    const existingShare = await redisGet(`audit:${jobId}:shared`);
    if (existingShare) {
      const existing = JSON.parse(existingShare);
      return NextResponse.json({ 
        ok: true, 
        coupon: existing.coupon, 
        message: "You already shared this audit — here's your coupon again." 
      });
    }

    // Verify tweet mentions @xanlens_
    let verified = false;
    try {
      // Fetch the tweet page and check for @xanlens_ mention
      const res = await fetch(tweetUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
        signal: AbortSignal.timeout(8000),
        redirect: "follow",
      });
      if (res.ok) {
        const html = await res.text();
        if (html.toLowerCase().includes("xanlens")) {
          verified = true;
        }
      }
    } catch {
      // If we can't fetch the tweet, be lenient — the URL format is valid
      // and they went through the effort of sharing
    }

    // Even if verification fails, we generate the coupon
    // The URL format check + effort is enough — we're not losing money on this
    // (free re-audit costs us ~$0.90 in grounding, but drives engagement)
    
    // Generate coupon
    const code = `GEO-${randomBytes(2).toString("hex").toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
    
    // Store coupon in Redis (48h TTL, single-use)
    const couponData = {
      code,
      tier: "pro",
      used: false,
      source: "share",
      jobId,
      tweetUrl,
      verified,
      createdAt: new Date().toISOString(),
    };
    await redisSet(`coupon:${code}`, JSON.stringify(couponData), 48 * 3600);

    // Mark this audit as shared (90 day TTL)
    await redisSet(`audit:${jobId}:shared`, JSON.stringify({ 
      coupon: code, 
      tweetUrl, 
      verified,
      at: new Date().toISOString() 
    }), 90 * 24 * 3600);

    return NextResponse.json({ 
      ok: true, 
      coupon: code,
      verified,
      message: verified 
        ? "Tweet verified! Here's your free re-audit coupon." 
        : "Thanks for sharing! Here's your free re-audit coupon."
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
