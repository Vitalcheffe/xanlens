import { NextRequest, NextResponse } from "next/server";
import { redisGet, redisSet } from "@/app/lib/redis";
import { buildAllPrompts, selectPrompts } from "@/app/lib/prompts";
import { createUser, addAuditToHistory, getOrCreateSessionToken } from "@/app/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;
// crypto helpers
function randomUUID(): string {
  return crypto.randomUUID();
}
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

interface EngineConfig {
  name: string;
  tier: "full" | "standard" | "lite";
}

// Map engine name → required env var
const ENGINE_ENV_MAP: Record<string, string> = {
  gemini: "GEMINI_API_KEY",
  gemini_grounded: "GEMINI_API_KEY",
  gpt4o: "OPENAI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  claude: "ANTHROPIC_API_KEY",
  grok: "XAI_API_KEY",
  llama: "NVIDIA_API_KEY",
  qwen: "NVIDIA_API_KEY",
};

const ALL_ENGINE_CONFIGS: EngineConfig[] = [
  { name: "gemini", tier: "full" },
  { name: "gemini_grounded", tier: "standard" },
  { name: "gpt4o", tier: "standard" },
  { name: "deepseek", tier: "standard" },
  { name: "claude", tier: "lite" },
  { name: "grok", tier: "lite" },
  { name: "llama", tier: "standard" },
  { name: "qwen", tier: "standard" },
];

// Only include engines that have API keys configured and are not paused
import { ENGINES } from "@/app/lib/engine-config";
const ENGINE_CONFIGS = ALL_ENGINE_CONFIGS.filter(e => {
  const eng = ENGINES[e.name];
  if (eng?.unavailable) return false;
  const envVar = ENGINE_ENV_MAP[e.name];
  return envVar ? !!process.env[envVar] : true;
});

export async function POST(request: NextRequest) {
  try {
    // ── GLOBAL KILL SWITCH — no audits for anyone ──
    const AUDITS_ENABLED = true;
    if (!AUDITS_ENABLED) {
      return NextResponse.json({
        error: "Audits are temporarily disabled. Launching soon.",
        status: "maintenance",
      }, { status: 503 });
    }

    const body = await request.json();
    let { brand, website, industry = "", competitors = [], keywords = [], features = [], suggestedPrompts = [], description = "", email, wallet, coupon } = body;

    let detectQuality: "full" | "partial" | "failed" | "skipped" = "skipped";
    // Auto-detect from website — runs whenever website is provided and ANY field is missing
    // Hard 35s timeout — auto-detect must NEVER block the audit from proceeding
    if (website && (!brand || !industry || !description)) {
      try {
        const { autoDetect } = await import("@/app/lib/auto-detect");
        const detected = await Promise.race([
          autoDetect(website),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error("auto-detect timeout (35s)")), 35000)),
        ]);
        if (detected) {
          if (!brand && detected.brand) brand = detected.brand;
          if (!industry && detected.industry) industry = detected.industry;
          if (!description && detected.description) description = detected.description;
          if (competitors.length === 0 && detected.competitors?.length > 0) competitors = detected.competitors;
          if (keywords.length === 0 && detected.keywords?.length > 0) keywords = detected.keywords;
          if (features.length === 0 && detected.features?.length > 0) features = detected.features;
          if (suggestedPrompts.length === 0 && detected.suggestedPrompts?.length > 0) suggestedPrompts = detected.suggestedPrompts;
          // Check if we got the rich fields that generate more prompts
          detectQuality = (detected.suggestedPrompts?.length > 0 && detected.keywords?.length > 0) ? "full" : "partial";
        }
      } catch (e) {
        console.warn("[audit] Auto-detect failed, continuing with fallback:", (e as Error).message);
        detectQuality = "failed";
        // Last resort: extract brand from domain
        if (!brand) {
          const hostname = new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "");
          brand = hostname.split(".")[0].charAt(0).toUpperCase() + hostname.split(".")[0].slice(1);
        }
      }
    }

    if (!brand) {
      return NextResponse.json({ error: "brand is required — provide brand or website for auto-detection" }, { status: 400 });
    }

    // Free website audits = Gemini only. Paid API calls get all engines.
    const source = request.headers.get("X-Source");
    const isFreeWebsite = source === "website";

    // ── Coupon validation ──
    let couponRedeemed = false;
    if (coupon) {
      const code = coupon.toUpperCase().trim();
      const couponRaw = await redisGet(`coupon:${code}`);
      if (!couponRaw) {
        return NextResponse.json({ error: "Invalid or expired coupon code" }, { status: 400 });
      }
      const couponData = JSON.parse(couponRaw);
      const isUnlimitedCoupon = couponData.maxUses === 0 || couponData.maxUses === undefined;
      // Check if single-use coupon is already used (skip for unlimited coupons)
      if (!isUnlimitedCoupon && couponData.status === "used") {
        return NextResponse.json({ error: "Coupon already used" }, { status: 400 });
      }
      // Check if multi-use coupon has exceeded max uses
      if (!isUnlimitedCoupon && couponData.maxUses > 0 && (couponData.usedCount || 0) >= couponData.maxUses) {
        return NextResponse.json({ error: "Coupon usage limit reached" }, { status: 400 });
      }
      // Update coupon — unlimited coupons stay active, single-use get marked used
      const isUnlimited = couponData.maxUses === 0 || !couponData.maxUses;
      const newCount = (couponData.usedCount || 0) + 1;
      const newStatus = (isUnlimited || (couponData.maxUses && newCount < couponData.maxUses)) ? "active" : "used";
      await redisSet(`coupon:${code}`, JSON.stringify({
        ...couponData,
        status: newStatus,
        usedCount: newCount,
        lastUsedBy: wallet || "anonymous",
        lastUsedAt: Date.now(),
        brand,
      }), 0); // keep permanently for tracking
      couponRedeemed = true;
    }

    // ── Rate limiting ──
    // Coupon bypasses wallet requirement and rate limits
    if (!couponRedeemed) {
      // All audits require wallet connection
      if (!wallet) {
        return NextResponse.json({
          error: "Sign in to run an audit.",
          action: "connect_wallet",
        }, { status: 401 });
      }

      if (wallet && !isFreeWebsite) {
        // Pro/paid audit — no rate limit, all engines
      } else if (wallet && isFreeWebsite) {
        // Free audit with wallet — 1 free audit total per account
        const freeUsedKey = `free:wallet:${wallet.toLowerCase()}:used`;
        const existing = await redisGet(freeUsedKey);
        if (existing) {
          return NextResponse.json({
            error: "You've reached your audit limit. Use a coupon or pay $0.99 USDC for a Pro audit across all 7 AI engines.",
            action: "upgrade",
          }, { status: 429 });
        }
        await redisSet(freeUsedKey, JSON.stringify({ wallet, brand, ts: Date.now() }), 0); // permanent
      }
    }

    const jobId = randomUUID();
    const allPrompts = buildAllPrompts(brand, industry, competitors, keywords, features, suggestedPrompts);
    // Coupon users get full Pro engines even from website
    const engines = (isFreeWebsite && !couponRedeemed)
      ? ENGINE_CONFIGS.filter(e => e.name === "gemini" || e.name === "gemini_grounded")
      : ENGINE_CONFIGS;

    // Build the prompt plan (includes category for weighted scoring)
    const plan: Array<{ engine: string; prompt: string; promptIndex: number; category: string }> = [];
    let globalIndex = 0;

    for (const eng of engines) {
      const tier = isFreeWebsite ? "standard" : eng.tier;
      const selected = selectPrompts(allPrompts, tier);
      for (const p of selected) {
        plan.push({
          engine: eng.name,
          prompt: p.prompt,
          promptIndex: globalIndex++,
          category: p.category,
        });
      }
    }

    // Store job metadata + plan for server-side execution
        const auditTier = couponRedeemed ? "coupon" : (isFreeWebsite ? "free" : "pro");
    const metaTTL = auditTier === "free" ? 7 * 24 * 3600 : 90 * 24 * 3600;
    await redisSet(`audit:${jobId}:meta`, JSON.stringify({
      brand, website, industry, competitors, keywords, features, description,
      wallet: wallet || null,
      tier: auditTier,
      totalEngines: engines.length,
      totalWorkers: plan.length,
      createdAt: Date.now(),
    }), metaTTL);

    await redisSet(`audit:${jobId}:plan`, JSON.stringify(plan), metaTTL);

    await redisSet(`audit:${jobId}:done`, "0", metaTTL);

    // Save to user's audit history if wallet provided
    if (wallet) {
      await createUser(wallet, { email, isAgent: !isFreeWebsite });
      await addAuditToHistory(wallet, {
        jobId,
        brand,
        industry,
        website,
        tier: couponRedeemed ? "coupon" : (isFreeWebsite ? "free" : "pro"),
        createdAt: Date.now(),
        status: "processing",
      });
    }

    // Generate persistent session token for dashboard access
    const sessionToken = wallet ? await getOrCreateSessionToken(wallet) : undefined;

    const detectWarning = (detectQuality === "failed" || detectQuality === "partial")
      ? `Auto-detection was ${detectQuality} — for more accurate results with more prompts, call POST /api/v1/audit/detect first with {"website": "${website}"} and pass all returned fields (keywords, features, suggestedPrompts) back into this endpoint.`
      : undefined;

    return NextResponse.json({
      status: "ready",
      job_id: jobId,
      brand,
      detect_quality: detectQuality,
      ...(detectWarning && { detect_warning: detectWarning }),
      plan,
      total: plan.length,
      poll_url: `/api/v1/audit/status?jobId=${jobId}`,
      prompt_url: `/api/v1/audit/prompt`,
      execute_url: `/api/v1/audit/execute`,
      dashboard_url: sessionToken ? `/dashboard?token=${sessionToken}` : undefined,
      session_token: sessionToken,
      message: "Call execute_url with {jobId} to fire all prompts. Then poll poll_url for results.",
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e instanceof Error ? e.message : "Internal server error") }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "POST /api/v1/audit",
    description: "Submit a GEO audit. Returns job plan — frontend fires prompts individually.",
    engines: ENGINE_CONFIGS.map(e => `${e.name} (${e.tier})`),
    usage: {
      post: { website: "required (auto-detects brand, industry, competitors)", brand: "optional (auto-detected from website)", industry: "optional", competitors: "optional string[]" },
      prompt: "POST /api/v1/audit/prompt { jobId, engine, prompt, promptIndex }",
      poll: "GET /api/v1/audit/status?jobId=<job_id>",
    },
  });
}
