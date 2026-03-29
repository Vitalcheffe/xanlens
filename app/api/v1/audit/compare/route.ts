import { NextRequest, NextResponse } from "next/server";
import { redisGet, redisSet } from "@/app/lib/redis";
import { buildAllPrompts, selectPrompts } from "@/app/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Gemini-only quick audit for comparison (keeps it fast + free-tier friendly)
async function quickAudit(brand: string, industry: string): Promise<{ brand: string; mentioned_in: number; tested: number; coverage_pct: number; sample_snippets: string[] }> {
  const prompts = buildAllPrompts(brand, industry);
  const selected = selectPrompts(prompts, "lite"); // 2 per category for speed

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${process.env.GEMINI_API_KEY || ""}`;

  // Fire all prompts in parallel for speed
  const results = await Promise.allSettled(
    selected.map(async (p) => {
      const res = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: p.prompt }] }],
          generationConfig: { temperature: 0 },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return "";
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    })
  );

  let mentionCount = 0;
  const snippets: string[] = [];

  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value) continue;
    const text = r.value;
    if (text.toLowerCase().includes(brand.toLowerCase())) {
      mentionCount++;
      if (snippets.length < 2) snippets.push(text.slice(0, 200));
    }
  }

  const coverage_pct = selected.length > 0 ? Math.round((mentionCount / selected.length) * 100) : 0;

  return {
    brand,
    mentioned_in: mentionCount,
    tested: selected.length,
    coverage_pct,
    sample_snippets: snippets,
  };
}

export async function POST(request: NextRequest) {
  try {
    // KILL SWITCH
    const ENABLED = true;
    if (!ENABLED) return NextResponse.json({ error: "Temporarily disabled.", status: "maintenance" }, { status: 503 });
    const body = await request.json();
    const { brand, competitors, industry, email } = body;

    if (!brand || !industry) {
      return NextResponse.json({ error: "brand and industry are required" }, { status: 400 });
    }
    if (!competitors || !Array.isArray(competitors) || competitors.length === 0) {
      return NextResponse.json({ error: "competitors[] is required (max 3)" }, { status: 400 });
    }
    const compList = competitors.slice(0, 3) as string[];

    // Free tier: 1 comparison per email
    const source = request.headers.get("X-Source");
    const isFreeWebsite = source === "website";

    if (isFreeWebsite && email) {
      const emailHash = (await sha256Hex(email.toLowerCase().trim())).slice(0, 16);
      const freeKey = `free:compare:${emailHash}`;
      const existing = await redisGet(freeKey);
      if (existing) {
        return NextResponse.json({
          error: "You've already used your free comparison. Upgrade to Pro for unlimited comparisons.",
          upgrade_url: "/pricing",
        }, { status: 403 });
      }
      await redisSet(freeKey, JSON.stringify({ email, brand, ts: Date.now() }), 2592000);
    }

    // Run audits in parallel: brand + all competitors
    const [brandResults, ...competitorResults] = await Promise.all([
      quickAudit(brand, industry),
      ...compList.map(c => quickAudit(c, industry)),
    ]);

    return NextResponse.json({
      status: "complete",
      brand_results: brandResults,
      competitor_results: compList.map((name, i) => ({
        name,
        results: competitorResults[i],
      })),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e instanceof Error ? e.message : "Internal server error") }, { status: 500 });
  }
}
