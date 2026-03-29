import { NextRequest, NextResponse } from "next/server";
import { redisGet, redisSet, redisIncr } from "@/app/lib/redis";
import { ENGINES } from "@/app/lib/engine-config";

// Resolve TTL from audit meta (7d free / 90d pro), fallback 7d
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
    const { jobId, engine, prompts, chunkIndex } = await req.json();
    if (!jobId || !engine || !prompts?.length) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const eng = ENGINES[engine];
    if (!eng) return NextResponse.json({ error: `Unknown engine: ${engine}` }, { status: 400 });

    const ttl = await getAuditTTL(jobId);

    async function queryPrompt(prompt: string): Promise<string> {
      try {
        const headers = { "Content-Type": "application/json", ...eng.makeHeaders() };
        const body = JSON.stringify(eng.makeBody(prompt));
        const res = await fetch(eng.url, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.error(`[${engine}:${chunkIndex}] HTTP ${res.status}: ${errText.slice(0, 200)}`);
          await redisSet(`audit:${jobId}:${engine}:error:${chunkIndex}`, `HTTP ${res.status}: ${errText.slice(0, 300)}`, ttl).catch(() => {});
          return "";
        }
        const data = await res.json();
        if (data.error) {
          console.error(`[${engine}] ${JSON.stringify(data.error).slice(0, 150)}`);
          await redisSet(`audit:${jobId}:${engine}:error:${chunkIndex}`, JSON.stringify(data.error).slice(0, 300), ttl).catch(() => {});
          return "";
        }
        return eng.parseResponse(data);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "unknown";
        console.error(`[${engine}:${chunkIndex}] ${msg}`);
        await redisSet(`audit:${jobId}:${engine}:error:${chunkIndex}`, msg.slice(0, 300), ttl).catch(() => {});
        return "";
      }
    }

    const responses: string[] = [];
    const startTime = Date.now();
    for (const prompt of prompts) {
      if (Date.now() - startTime > 9000) break;
      responses.push(await queryPrompt(prompt));
    }
    while (responses.length < prompts.length) responses.push("");

    const nonEmpty = responses.filter(Boolean).length;
    await redisSet(`audit:${jobId}:${engine}:${chunkIndex}`, JSON.stringify(responses), ttl);
    await redisSet(`audit:${jobId}:${engine}:stats:${chunkIndex}`, JSON.stringify({ total: responses.length, nonEmpty, url: eng.url.slice(0, 60) }), ttl);

    const done = await redisIncr(`audit:${jobId}:done`);

    return NextResponse.json({ ok: true, engine, chunk: chunkIndex, responses: nonEmpty, totalDone: done });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
