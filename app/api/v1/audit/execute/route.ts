import { NextRequest, NextResponse } from "next/server";
import { redisGet, redisSet } from "@/app/lib/redis";

export const runtime = "nodejs";
export const maxDuration = 120;

interface PlanItem {
  engine: string;
  prompt: string;
  promptIndex: number;
  persona?: string;
  category?: string;
}

export async function POST(req: NextRequest) {
  try {
    // KILL SWITCH
    const ENABLED = true;
    if (!ENABLED) return NextResponse.json({ error: "Temporarily disabled.", status: "maintenance" }, { status: 503 });

    const { jobId } = await req.json();
    if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

    const planRaw = await redisGet(`audit:${jobId}:plan`);
    if (!planRaw) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    const plan: PlanItem[] = JSON.parse(planRaw);

    // Get the base URL from the request
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("host") || "xanlens.com";
    const baseUrl = `${proto}://${host}`;

    // Get job metadata for side-checks (technical audit, AIO, SEO score, content optimizer)
    const metaRaw = await redisGet(`audit:${jobId}:meta`);
    const meta = metaRaw ? JSON.parse(metaRaw) : {};
    const { brand, website, industry, description } = meta;

    // Fire prompts in staggered batches to avoid overwhelming Vercel concurrency limits
    // Vercel free tier has ~10-15 concurrent function limit — batch conservatively
    const BATCH_SIZE = 8;
    const BATCH_DELAY_MS = 1500;
    let dispatched = 0;

    for (let i = 0; i < plan.length; i += BATCH_SIZE) {
      const batch = plan.slice(i, i + BATCH_SIZE);
      for (const task of batch) {
        fetch(`${baseUrl}/api/v1/audit/prompt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            engine: task.engine,
            prompt: task.prompt,
            promptIndex: task.promptIndex,
            persona: task.persona,
          }),
        }).catch(() => {});
        dispatched++;
      }
      // Wait between batches — let Vercel spin up and finish some functions
      if (i + BATCH_SIZE < plan.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    // Fire side-checks — these run as separate Vercel functions via fetch
    // Fire-and-forget for fast ones, but store results via a self-contained endpoint
    if (website) {
      const tier = meta.tier || "free";
      const sideTTL = tier === "free" ? 7 * 24 * 3600 : 90 * 24 * 3600;

      // Technical check writes its own results to Redis (worker owns persistence)
      // — just trigger it with jobId, don't wait for response
      fetch(`${baseUrl}/api/v1/audit/technical?url=${encodeURIComponent(website)}&brand=${encodeURIComponent(brand || "")}&industry=${encodeURIComponent(industry || "")}&description=${encodeURIComponent(description || "")}&jobId=${jobId}`, {
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});

      // Other side checks (fast, <55s) — caller writes to Redis
      const checks: Record<string, string> = {
        aio: `${baseUrl}/api/v1/audit/aio?url=${encodeURIComponent(website)}`,
        "seo-score": `${baseUrl}/api/v1/audit/seo-score?brand=${encodeURIComponent(brand || "")}&industry=${encodeURIComponent(industry || "")}&website=${encodeURIComponent(website)}`,
        "content-optimizer": `${baseUrl}/api/v1/audit/content-optimizer?url=${encodeURIComponent(website)}`,
      };

      await Promise.allSettled(
        Object.entries(checks).map(async ([key, url]) => {
          try {
            const r = await fetch(url, { signal: AbortSignal.timeout(55000) });
            if (!r.ok) return;
            const data = await r.json();
            if (data) {
              await redisSet(`audit:${jobId}:side:${key}`, JSON.stringify(data), sideTTL);
            }
          } catch { /* side-check failed — non-fatal */ }
        })
      );
    }

    return NextResponse.json({ ok: true, total: plan.length, dispatched });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e instanceof Error ? e.message : "Execution failed") }, { status: 500 });
  }
}
