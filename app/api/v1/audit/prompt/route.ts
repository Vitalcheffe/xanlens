import { NextRequest, NextResponse } from "next/server";
import { redisGet, redisSet, redisIncr } from "@/app/lib/redis";
import { ENGINES } from "@/app/lib/engine-config";

async function getAuditTTL(jobId: string): Promise<number> {
  try {
    const raw = await redisGet(`audit:${jobId}:meta`);
    if (raw) {
      const meta = JSON.parse(raw);
      return meta.tier === "pro" ? 90 * 24 * 3600 : 7 * 24 * 3600;
    }
  } catch {}
  return 7 * 24 * 3600;
}

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // KILL SWITCH
    const ENABLED = true;
    if (!ENABLED) return NextResponse.json({ error: "Temporarily disabled.", status: "maintenance" }, { status: 503 });

    const { jobId, engine, prompt, promptIndex, persona } = await req.json();
    if (!jobId || !engine || !prompt) {
      return NextResponse.json({ error: "Missing jobId, engine, or prompt" }, { status: 400 });
    }

    const eng = ENGINES[engine];
    if (!eng) return NextResponse.json({ error: `Unknown engine: ${engine}` }, { status: 400 });

    // Increment done counter FIRST — ensures completion even if function times out
    await redisIncr(`audit:${jobId}:done`);

    const ttl = await getAuditTTL(jobId);

    // Store prompt text + persona for coverage report
    const promptData = persona ? JSON.stringify({ text: prompt, persona }) : prompt;
    await redisSet(`audit:${jobId}:prompt:${promptIndex}`, promptData, ttl);

    let response = "";
    let error = "";

    if (eng.unavailable) {
      error = "Engine unavailable";
    } else {
      // Timeouts: keep well under Vercel's 60s limit
      // Account for cold start (~3s) + Redis writes (~2s) = ~5s overhead
      // Keep under Vercel's 60s limit (cold start ~3s + Redis ~2s overhead)
      const timeout = engine.includes("grounded") ? 50000 : 45000;
      try {
        const res = await fetch(eng.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...eng.makeHeaders() },
          body: JSON.stringify(eng.makeBody(prompt)),
          signal: AbortSignal.timeout(timeout),
        });
        if (!res.ok) {
          error = `HTTP ${res.status}`;
          const errText = await res.text().catch(() => "");
          error += `: ${errText.slice(0, 200)}`;
        } else {
          const data = await res.json();
          if (data.error) {
            error = JSON.stringify(data.error).slice(0, 200);
          } else {
            response = eng.parseResponse(data);
          }
        }
      } catch (e: unknown) {
        error = e instanceof Error ? e.message : "timeout";
      }
    }

    // Store response (even if empty — status route needs the key to exist)
    await redisSet(
      `audit:${jobId}:${engine}:p:${promptIndex}`,
      JSON.stringify({ response, error: error || undefined }),
      ttl
    );

    return NextResponse.json({
      ok: true,
      engine,
      promptIndex,
      hasResponse: !!response,
      error: error || undefined,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
