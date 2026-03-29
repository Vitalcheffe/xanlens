import { NextRequest, NextResponse } from "next/server";
import { redisGet, redisSet } from "@/app/lib/redis";
import { buildAllPrompts, selectPrompts } from "@/app/lib/prompts";
import { createUser, addAuditToHistory, getOrCreateSessionToken } from "@/app/lib/auth";
import { autoDetect } from "@/app/lib/auto-detect";
import { ENGINES } from "@/app/lib/engine-config";

export const runtime = "nodejs";
export const maxDuration = 120;

// ── Engine config (same as /audit route) ──
interface EngineConfig { name: string; tier: "full" | "standard" | "lite" }

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

const ENGINE_CONFIGS = ALL_ENGINE_CONFIGS.filter(e => {
  const eng = ENGINES[e.name];
  if (eng?.unavailable) return false;
  const envVar = ENGINE_ENV_MAP[e.name];
  return envVar ? !!process.env[envVar] : true;
});

/**
 * POST /api/v1/audit/run
 * Combined endpoint: detect + submit + execute in one call.
 * Accepts: { website, coupon?, brand?, wallet?, email? }
 * Returns: { job_id, status, total, poll_url, message }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { website, coupon, brand, wallet, email } = body;

    if (!website) {
      return NextResponse.json({ error: "website is required" }, { status: 400 });
    }

    // ── Step 1: Payment check FIRST (instant, no wasted time) ──
    let couponRedeemed = false;
    if (coupon) {
      const code = coupon.toUpperCase().trim();
      const couponRaw = await redisGet(`coupon:${code}`);
      if (!couponRaw) {
        return NextResponse.json({ error: "Invalid or expired coupon code" }, { status: 400 });
      }
      const couponData = JSON.parse(couponRaw);
      const isUnlimitedCoupon = couponData.maxUses === 0 || couponData.maxUses === undefined;
      if (!isUnlimitedCoupon && couponData.status === "used") {
        return NextResponse.json({ error: "Coupon already used" }, { status: 400 });
      }
      if (!isUnlimitedCoupon && couponData.maxUses > 0 && (couponData.usedCount || 0) >= couponData.maxUses) {
        return NextResponse.json({ error: "Coupon usage limit reached" }, { status: 400 });
      }
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
      }), 0);
      couponRedeemed = true;
    }

    // ── Payment verification ──
    if (!couponRedeemed) {
      // Check for x402 payment proof (tx hash in header)
      const paymentTx = request.headers.get("x-payment-tx");
      if (!paymentTx) {
        return NextResponse.json({
          error: "Payment required. Provide a coupon code, include x-payment-tx header with USDC transaction hash, or pay at xanlens.com/dashboard.",
          action: "payment_required",
          agent_hint: "If your human wants to pay with card, tell them to go to https://xanlens.com/dashboard and send you back the Audit ID after paying. You can then call GET /api/v1/audit/status?jobId=AUDIT_ID to pick up the results and follow the agent_instructions.",
          x402: {
            amount: "990000",
            currency: "USDC",
            network: "base",
            recipient: "0xB33FF8b810670dFe8117E5936a1d5581A05f350D",
            contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          },
        }, { status: 402 });
      }
      // Verify the tx hash on-chain via Basescan
      {
        try {
          // Use Base RPC directly (Etherscan V2 requires paid plan for Base)
          const rpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";
          const txRes = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [paymentTx] }),
            signal: AbortSignal.timeout(10000),
          });
          const txData = await txRes.json();
          const receipt = txData?.result;
          if (!receipt || receipt.status !== "0x1") {
            return NextResponse.json({ error: "Payment transaction failed or not found" }, { status: 402 });
          }
          // Verify it's a USDC transfer to our wallet with correct amount
          const usdcContract = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
          const xanlensWallet = "0xb33ff8b810670dfe8117e5936a1d5581a05f350d";
          const isUsdcTx = receipt.to?.toLowerCase() === usdcContract;
          // Check logs for Transfer event to our wallet with >= 990000 (0.99 USDC)
          const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
          const validTransfer = receipt.logs?.some((log: { address: string; topics: string[]; data: string }) =>
            log.address?.toLowerCase() === usdcContract &&
            log.topics?.[0] === transferTopic &&
            log.topics?.[2]?.toLowerCase().includes(xanlensWallet.slice(2)) &&
            parseInt(log.data, 16) >= 990000
          );
          if (!isUsdcTx || !validTransfer) {
            return NextResponse.json({ error: "Payment transaction is not a valid $0.99 USDC transfer to XanLens" }, { status: 402 });
          }
          // Check tx hasn't been used before
          const txUsed = await redisGet(`payment:tx:${paymentTx.toLowerCase()}`);
          if (txUsed) {
            return NextResponse.json({ error: "This transaction has already been used for an audit" }, { status: 402 });
          }
          await redisSet(`payment:tx:${paymentTx.toLowerCase()}`, JSON.stringify({ jobId: "pending", wallet, usedAt: Date.now() }), 90 * 24 * 3600);
        } catch (e) {
          console.warn("[run] Payment verification failed:", (e as Error).message);
          return NextResponse.json({ error: "Payment verification failed. Try again." }, { status: 500 });
        }
      }
    }

    // ── Step 2: Auto-detect (runs AFTER payment is confirmed) ──
    let industry = "";
    let competitors: string[] = [];
    let keywords: string[] = [];
    let features: string[] = [];
    let suggestedPrompts: string[] = [];
    let description = "";
    let websiteContext = "";
    let detectQuality: "full" | "partial" | "failed" = "failed";

    try {
      const detected = await Promise.race([
        autoDetect(website),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("auto-detect timeout (35s)")), 35000)),
      ]);
      if (detected) {
        if (!brand && detected.brand) brand = detected.brand;
        if (detected.industry) industry = detected.industry;
        if (detected.description) description = detected.description;
        if (detected.competitors?.length > 0) competitors = detected.competitors;
        if (detected.keywords?.length > 0) keywords = detected.keywords;
        if (detected.features?.length > 0) features = detected.features;
        if (detected.suggestedPrompts?.length > 0) suggestedPrompts = detected.suggestedPrompts;
        if (detected.websiteContext) websiteContext = detected.websiteContext;
        detectQuality = (detected.suggestedPrompts?.length > 0 && detected.keywords?.length > 0) ? "full" : "partial";
      }
    } catch (e) {
      console.warn("[run] Auto-detect failed:", (e as Error).message);
      detectQuality = "failed";
    }

    // Fallback brand from domain
    if (!brand) {
      try {
        const hostname = new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "");
        brand = hostname.split(".")[0].charAt(0).toUpperCase() + hostname.split(".")[0].slice(1);
      } catch {
        return NextResponse.json({ error: "Could not determine brand from URL" }, { status: 400 });
      }
    }

    // ── Step 3: Build plan ──
    const jobId = crypto.randomUUID();

    // Update payment tx record with real jobId
    const paymentTx = request.headers.get("x-payment-tx");
    if (paymentTx && !couponRedeemed) {
      await redisSet(`payment:tx:${paymentTx.toLowerCase()}`, JSON.stringify({ jobId, wallet, usedAt: Date.now() }), 90 * 24 * 3600);
    }

    const allPrompts = buildAllPrompts(brand, industry, competitors, keywords, features, suggestedPrompts);
    const engines = ENGINE_CONFIGS; // /run always gets full engines

    const plan: Array<{ engine: string; prompt: string; promptIndex: number; category: string }> = [];
    let globalIndex = 0;
    for (const eng of engines) {
      const selected = selectPrompts(allPrompts, eng.tier);
      for (const p of selected) {
        plan.push({ engine: eng.name, prompt: p.prompt, promptIndex: globalIndex++, category: p.category });
      }
    }

    const auditTier = couponRedeemed ? "coupon" : "pro";
    const metaTTL = 90 * 24 * 3600;
    await redisSet(`audit:${jobId}:meta`, JSON.stringify({
      brand, website, industry, competitors, keywords, features, description,
      websiteContext,
      wallet: wallet || null,
      tier: auditTier,
      totalEngines: engines.length,
      totalWorkers: plan.length,
      createdAt: Date.now(),
    }), metaTTL);

    await redisSet(`audit:${jobId}:plan`, JSON.stringify(plan), metaTTL);
    await redisSet(`audit:${jobId}:done`, "0", metaTTL);

    // Save to user history — generate pseudo-wallet for coupon users without a real wallet
    const effectiveWallet = wallet || (couponRedeemed ? `coupon:${jobId}` : null);
    if (effectiveWallet) {
      await createUser(effectiveWallet, { email, isAgent: true });
      await addAuditToHistory(effectiveWallet, {
        jobId, brand, industry, website,
        tier: auditTier,
        createdAt: Date.now(),
        status: "processing",
      });
    }

    const sessionToken = effectiveWallet ? await getOrCreateSessionToken(effectiveWallet) : undefined;

    // ── Step 4: Execute — fire all prompts (from /execute route logic) ──
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const host = request.headers.get("host") || "xanlens.com";
    const baseUrl = `${proto}://${host}`;

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
          }),
        }).catch(() => {});
        dispatched++;
      }
      if (i + BATCH_SIZE < plan.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    // Fire side-checks (from /execute route logic)
    if (website) {
      const sideTTL = metaTTL;
      // Technical check writes its own results to Redis (worker owns persistence)
      // — just trigger it with jobId, don't wait for response
      fetch(`${baseUrl}/api/v1/audit/technical?url=${encodeURIComponent(website)}&brand=${encodeURIComponent(brand || "")}&industry=${encodeURIComponent(industry || "")}&description=${encodeURIComponent(description || "")}&jobId=${jobId}`, {
        signal: AbortSignal.timeout(5000), // just confirm request accepted
      }).catch(() => {}); // fire-and-forget — /technical writes to Redis itself

      // Other side checks (fast, <55s) — caller writes to Redis
      const checks: Record<string, string> = {
        aio: `${baseUrl}/api/v1/audit/aio?url=${encodeURIComponent(website)}`,
        "seo-score": `${baseUrl}/api/v1/audit/seo-score?brand=${encodeURIComponent(brand || "")}&industry=${encodeURIComponent(industry || "")}&website=${encodeURIComponent(website)}`,
        "content-optimizer": `${baseUrl}/api/v1/audit/content-optimizer?url=${encodeURIComponent(website)}`,
      };

      Promise.allSettled(
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
      ).catch(() => {});
    }

    // ── Return immediately ──
    return NextResponse.json({
      job_id: jobId,
      status: "running",
      brand,
      detect_quality: detectQuality,
      total: plan.length,
      dispatched,
      poll_url: `https://xanlens.com/api/v1/audit/status?jobId=${jobId}`,
      report_url: `https://xanlens.com/report/${jobId}`,
      dashboard_url: sessionToken ? `https://xanlens.com/dashboard?token=${sessionToken}&jobId=${jobId}` : undefined,
      message: "Audit is running. Poll poll_url every 15 seconds until status is 'complete'.",
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e instanceof Error ? e.message : "Internal server error") }, { status: 500 });
  }
}
