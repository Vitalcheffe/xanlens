import { NextRequest, NextResponse } from "next/server";
import { redisGet, redisSet } from "@/app/lib/redis";
import { scoreEngineResponses, scorePromptResult, analyzeMentions } from "@/app/lib/mention-analyzer";
import { batchJudgeMentions, llmJudgeMention } from "@/app/lib/llm-judge";
import { getSearchVolumes, enrichWithVolume } from "@/app/lib/search-volume";
import { updateAuditStatus, getOrCreateSessionToken } from "@/app/lib/auth";
import { auditWebsiteHealth, discoverBacklinks } from "@/app/lib/website-health";
import { storeAudit, storePrompts, storeAuthority, storeTechnical } from "@/app/lib/analytics-db";
import { buildAgentInstructions } from "@/app/lib/agent-instructions";

export const runtime = "nodejs";
export const maxDuration = 120; // Extended for judge retries on rate limits

/** Sanitize AI engine response text — strip control chars and invalid escape sequences that break JSON */
function sanitizeText(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ");
}

const ENGINE_NAMES = ["gemini", "gemini_grounded", "gpt4o", "claude", "grok", "deepseek", "llama", "qwen"];

// Human-readable model names for each engine
const ENGINE_MODEL_NAMES: Record<string, string> = {
  gemini: "Gemini 3 Flash",
  gemini_grounded: "Gemini 2.5 Flash (Grounded)",
  gpt4o: "GPT-5.2",
  claude: "Claude 3.5 Haiku",
  grok: "Grok 4.1 Fast",
  deepseek: "DeepSeek V3",
  llama: "Llama 4 Maverick",
  qwen: "Qwen3 Next 80B",
  perplexity: "Sonar Pro",
};

// Engine source type — training data (knowledge) vs grounded (live search)
const ENGINE_SOURCE_TYPE: Record<string, "training" | "grounded"> = {
  gemini: "training",
  gemini_grounded: "grounded",
  gpt4o: "training",
  claude: "training",
  grok: "training",
  deepseek: "training",
  llama: "training",
  qwen: "training",
  perplexity: "grounded",
};

// Gemini grounded is now handled as a regular engine in the worker system
// Results are read from Redis, not computed live (fixes edge timeout)

// ── Content gap patterns: AI says "I don't know" ──
const BLIND_SPOT_PATTERNS = [
  /i don'?t have (?:specific |enough )?information/i,
  /i'?m not (?:familiar|aware)/i,
  /i couldn'?t find/i,
  /no (?:specific |widely |publicly )?(?:known|recognized|available) (?:information|data|details)/i,
  /doesn'?t have a (?:widely |specific |well-)?(?:recognized|known|defined|established)/i,
  /i don'?t (?:know|recognize)/i,
  /not (?:a )?(?:widely |well-)?(?:known|recognized|established) (?:brand|company|tool|product|platform)/i,
  /no (?:results|data|info) (?:found|available)/i,
  /unable to (?:find|verify|confirm)/i,
  /cannot (?:find|confirm|verify)/i,
  /as of my (?:last |knowledge )?(?:update|cutoff)/i,
];

function isBlindSpot(response: string): boolean {
  return BLIND_SPOT_PATTERNS.some(p => p.test(response));
}

// ── Citation source extraction: pull URLs from responses ──
// Filters out hallucinated URLs (AI engines fabricate brand-like domains)
function extractCitations(response: string, brand?: string, website?: string): string[] {
  const urlRegex = /https?:\/\/[^\s"'<>\])\},]+/gi;
  const matches = response.match(urlRegex) || [];
  const cleaned = matches.map(u => u.replace(/[.,;:!?)]+$/, ""));
  
  // Get the real brand domain for comparison
  let realDomain = "";
  if (website) {
    try {
      realDomain = new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "");
    } catch {}
  }
  const brandSlug = brand?.toLowerCase().replace(/\s+/g, "") || "";
  
  // Filter out likely hallucinated URLs:
  // 1. URLs containing the brand name that aren't the actual website domain
  // 2. URLs that don't resolve to known real domains
  const filtered = cleaned.filter(url => {
    try {
      const domain = new URL(url).hostname.replace(/^www\./, "");
      // If it's the brand's actual domain, keep it
      if (realDomain && domain === realDomain) return true;
      // If domain contains the brand slug but ISN'T the real domain, likely hallucinated
      if (brandSlug && brandSlug.length >= 3 && domain.includes(brandSlug) && domain !== realDomain) return false;
      return true;
    } catch { return false; }
  });
  
  return [...new Set(filtered)];
}

// ── Brand hash for history key ──
function brandHash(brand: string, website?: string): string {
  const key = `${brand.toLowerCase().trim()}:${(website || "").toLowerCase().replace(/https?:\/\//, "").replace(/\/$/, "")}`;
  // Simple hash
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  const metaRaw = await redisGet(`audit:${jobId}:meta`);
  if (!metaRaw) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const meta = JSON.parse(metaRaw);
  const { brand, website, industry, totalWorkers, wallet: jobWallet, keywords: metaKeywords, features: metaFeatures, description: metaDescription, tier: metaTier, websiteContext: metaWebsiteContext } = meta;
  // Build semantic validation keywords from features + keywords
  const descriptionKeywords: string[] = [
    ...((metaFeatures || []) as string[]),
    ...((metaKeywords || []) as string[]).slice(0, 5),
  ].map((k: string) => k.toLowerCase());

  // ── Fast path: return cached result if already computed ──
  const cachedResult = await redisGet(`audit:${jobId}:scored:v32`);
  if (cachedResult) {
    const cached = JSON.parse(cachedResult);
    // Re-attach side-check results (may have arrived after initial cache)
    if (!cached.technical || !cached.aio || !cached.content_optimizer || !cached.seo_score || !cached.website_health) {
      try {
        const [techRaw, aioRaw, seoRaw, contentRaw, healthRaw] = await Promise.all([
          redisGet(`audit:${jobId}:side:technical`),
          redisGet(`audit:${jobId}:side:aio`),
          redisGet(`audit:${jobId}:side:seo-score`),
          redisGet(`audit:${jobId}:side:content-optimizer`),
          redisGet(`audit:${jobId}:health`),
        ]);
        let updated = false;
        if (techRaw && !cached.technical) { cached.technical = JSON.parse(techRaw); updated = true; }
        if (aioRaw && !cached.aio) { cached.aio = JSON.parse(aioRaw); updated = true; }
        if (seoRaw && !cached.seo_score) { cached.seo_score = JSON.parse(seoRaw); updated = true; }
        if (contentRaw && !cached.content_optimizer) { cached.content_optimizer = JSON.parse(contentRaw); updated = true; }
        if (healthRaw && !cached.website_health) { cached.website_health = JSON.parse(healthRaw); updated = true; }

        // Generate website_health on-demand if still missing (never ran or failed)
        if (!cached.website_health && website) {
          try {
            const metaKw = (await redisGet(`audit:${jobId}:meta`).then(r => r ? JSON.parse(r) : null))?.keywords || [];
            const [healthResult, backlinkResult] = await Promise.all([
              auditWebsiteHealth(website, metaKw).catch(() => null),
              discoverBacklinks(website, cached.brand || brand).catch(() => null),
            ]);
            if (healthResult) {
              const healthData = { ...healthResult, backlinks: backlinkResult || { referringDomains: 0, categories: {}, topReferrers: [] } };
              cached.website_health = healthData;
              const isPro = cached.tier === "pro" || cached.tier === "coupon";
              const healthTTL = isPro ? 90 * 24 * 3600 : 7 * 24 * 3600;
              redisSet(`audit:${jobId}:health`, JSON.stringify(healthData), healthTTL).catch(() => {});
              updated = true;
            }
          } catch {}
        }

        // Generate AIO on-demand if still missing
        if (!cached.aio && website) {
          try {
            const proto = req.headers.get("x-forwarded-proto") || "https";
            const host = req.headers.get("host") || "xanlens.com";
            const aioUrl = `${proto}://${host}/api/v1/audit/aio?url=${encodeURIComponent(website)}`;
            const aioResp = await fetch(aioUrl, { signal: AbortSignal.timeout(25000) });
            if (aioResp.ok) {
              const aioData = await aioResp.json();
              if (aioData && aioData.overall_score != null) {
                cached.aio = aioData;
                const isPro = cached.tier === "pro" || cached.tier === "coupon";
                const sideTTL = isPro ? 90 * 24 * 3600 : 7 * 24 * 3600;
                redisSet(`audit:${jobId}:side:aio`, JSON.stringify(aioData), sideTTL).catch(() => {});
                updated = true;
              }
            }
          } catch {}
        }

        // Generate seo_score on-demand if still missing
        if (!cached.seo_score && brand && industry) {
          try {
            const proto = req.headers.get("x-forwarded-proto") || "https";
            const host = req.headers.get("host") || "xanlens.com";
            const seoUrl = `${proto}://${host}/api/v1/audit/seo-score?brand=${encodeURIComponent(brand)}&industry=${encodeURIComponent(industry)}&website=${encodeURIComponent(website || "")}`;
            const seoResp = await fetch(seoUrl, { signal: AbortSignal.timeout(20000) });
            if (seoResp.ok) {
              const seoData = await seoResp.json();
              if (seoData && seoData.available) {
                cached.seo_score = seoData;
                const isPro = cached.tier === "pro" || cached.tier === "coupon";
                const sideTTL = isPro ? 90 * 24 * 3600 : 7 * 24 * 3600;
                redisSet(`audit:${jobId}:side:seo-score`, JSON.stringify(seoData), sideTTL).catch(() => {});
                updated = true;
              }
            }
          } catch {}
        }

        // Re-cache with all data included
        if (updated) {
          redisSet(`audit:${jobId}:scored:v32`, JSON.stringify(cached), 3600).catch(() => {});
          // Also update the long-term result store
          const isPro = cached.tier === "pro" || cached.tier === "coupon";
          const resultTTL = isPro ? 90 * 24 * 3600 : 7 * 24 * 3600;
          redisSet(`audit:result:${jobId}`, JSON.stringify(cached), resultTTL).catch(() => {});
        }
      } catch {}
    }
    // Ensure report_url + share fields exist (backfill for pre-deploy caches)
    if (!cached.report_url) {
      const reportUrl = `https://xanlens.com/report/${jobId}`;
      cached.report_url = reportUrl;
      cached.share = {
        message: "Share your GEO score on X to get a free re-audit coupon! Post your score mentioning @xanlens_ and DM us the link.",
        suggested_tweet: `My brand "${cached.brand || brand}" scored ${cached.overall_score ?? cached.score ?? 0}/100 (${cached.grade || "?"}) on AI visibility 🔍\n\nHow visible is YOUR brand to ChatGPT, Gemini & Perplexity?\n\n@xanlens_`,
        report_url: reportUrl,
        note: "Tip: Post as text + image (no links) for better X reach. Download your score card from the report page.",
      };
      // Store for report page + update cache
      const isPro = cached.tier === "pro" || cached.tier === "coupon";
      const resultTTL = isPro ? 90 * 24 * 3600 : 7 * 24 * 3600;
      redisSet(`audit:result:${jobId}`, JSON.stringify(cached), resultTTL).catch(() => {});
      redisSet(`audit:${jobId}:scored:v32`, JSON.stringify(cached), 3600).catch(() => {});
    }

    // ── Agent Instructions (cached path) ──
    if (!cached.agent_instructions) {
      const cachedHealth = cached.website_health as { score: number; checks: Array<{ name: string; status: string; value: string; impact: string; recommendation?: string }> } | undefined;
      const cachedEngines = (cached.engines || {}) as Record<string, { score: number; mentions: number; sentiment: string; sample_snippets: string[]; prompts_tested: number }>;
      const cachedPromptDetails = ((cached.prompt_coverage as { details?: Array<{ prompt: string; engine: string; mentioned: boolean; blind_spot: boolean; snippet: string | null; category: string }> })?.details || []);
      const cachedBlindSpotsList = ((cached.blind_spots as { prompts?: Array<{ prompt: string; category: string; type?: string; severity?: string }> })?.prompts || []);

      cached.agent_instructions = buildAgentInstructions({
        jobId,
        brand: (cached.brand as string) || brand,
        website: (cached.website as string) || website || "",
        industry: (cached.industry as string) || industry || "",
        description: metaDescription || "",
        features: (metaFeatures as string[]) || [],
        keywords: (metaKeywords as string[]) || [],
        competitors: (cached.competitors as string[]) || [],
        overallScore: (cached.overall_score as number) ?? (cached.score as number) ?? 0,
        grade: (cached.grade as string) || "?",
        knowledgeScore: (cached.knowledge_score as number) ?? 0,
        discoverabilityScore: (cached.discoverability_score as number) ?? 0,
        citationScore: (cached.citation_score as number) ?? 0,
        websiteHealthScore: cachedHealth?.score ?? 0,
        websiteHealthChecks: cachedHealth?.checks || [],
        engines: cachedEngines,
        blindSpots: cachedBlindSpotsList,
        promptDetails: cachedPromptDetails,
      });
    }

    // ── Narrative (cached path) — generate if missing ──
    if (!cached.narrative) {
      try {
        const narrativeCacheKey = `audit:${jobId}:narrative`;
        const cachedNarrative = await redisGet(narrativeCacheKey);
        if (cachedNarrative) {
          cached.narrative = cachedNarrative;
        } else {
          const isPro = cached.tier === "pro" || cached.tier === "coupon";
          const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
          if (isPro && GEMINI_KEY) {
            const cEngines = (cached.engines || {}) as Record<string, any>;
            const activeEngineEntries = Object.entries(cEngines).filter(([, e]) => !e.unavailable && e.status !== "paused");
            const pausedEngineEntries = Object.entries(cEngines).filter(([, e]) => e.unavailable || e.status === "paused");
            const engineSummary = activeEngineEntries.map(([name, e]) =>
              `${ENGINE_MODEL_NAMES[name] || name}: score ${e.score}/100, ${e.mentions} mentions in ${e.prompts_total} prompts`
            ).join("; ");
            const pausedNote = pausedEngineEntries.length > 0
              ? `\n- Paused engines (NOT included in scoring, currently in beta): ${pausedEngineEntries.map(([name]) => ENGINE_MODEL_NAMES[name] || name).join(", ")}`
              : "";
            const cComp = (cached.competitor_analysis || {}) as any;
            const compSummary = cComp?.competitors?.map((c: any) => `${c.name}: ${c.mentions} mentions, ${c.visibility}% visibility`).join("; ") || "none detected";
            const cPromptDetails = ((cached.prompt_coverage as any)?.details || []) as Array<{ category?: string; mentioned?: boolean }>;
            const catSummary = Object.entries(
              cPromptDetails.reduce((acc: Record<string, { total: number; mentioned: number }>, d) => {
                const cat = d.category || "other";
                if (!acc[cat]) acc[cat] = { total: 0, mentioned: 0 };
                acc[cat].total++;
                if (d.mentioned) acc[cat].mentioned++;
                return acc;
              }, {})
            ).map(([cat, v]) => `${cat}: ${v.mentioned}/${v.total} (${Math.round((v.mentioned / v.total) * 100)}%)`).join("; ");
            const cBlindSpots = (cached.blind_spots as any)?.count || 0;

            const narrativePrompt = `You are a senior AI visibility strategist writing an executive report for ${cached.brand || brand} (${cached.website || website}).

AUDIT DATA:
- Overall GEO Score: ${cached.overall_score}/100 (Grade ${cached.grade})
- Knowledge Score: ${cached.knowledge_score}/100 (how well AI training data knows the brand)
- Discoverability Score: ${cached.discoverability_score}/100 (how well grounded/search AI finds the brand)
- Active engines tested: ${engineSummary}${pausedNote}
- Prompt coverage by category: ${catSummary}
- Competitors (share of voice): ${compSummary}
- Brand SOV: ${cComp?.share_of_voice ?? "N/A"}%
- Blind spots: ${cBlindSpots} prompts where brand was not mentioned
- Industry: ${cached.industry || "technology"}

SCORING METHODOLOGY:
- Knowledge Score = how well AI engines know the brand from training data. Only ACTIVE engines are scored — paused engines are excluded entirely from calculations.
- Discoverability Score = how well grounded/real-time AI search finds the brand.
- GEO Score = weighted: 55% Knowledge + 25% Discoverability + 20% Citation.
- Share of Voice = % of mentions in non-branded prompts. Organic competitive standing.
- Blind spots = non-branded prompts where brand was NOT mentioned.

WRITING RULES:
1. Start with a bold title summarizing the brand's AI visibility status (e.g., "## Strong Discoverability, Weak Knowledge" or "## Invisible to AI Engines").
2. Follow with a one-line verdict in plain English.
3. Write 3-4 short paragraphs. Use bullet points where listing multiple items (engines, categories, gaps). Keep paragraphs tight — 2-4 sentences max. Add line breaks between sections for readability.
4. Be specific — cite actual scores, engine names, and category percentages. Don't be vague.
5. Explain metric relationships (e.g., "high discoverability but low knowledge means search-connected AI finds you but parametric models haven't absorbed your brand yet").
6. Only discuss ACTIVE engines. Do NOT mention paused/unavailable engines or claim they scored 0 — they were not tested.
7. Identify the **#1 biggest opportunity** and the **#1 biggest risk** — use bold for emphasis.
8. End with a "What to do next" section with 2-3 concrete bullet points (not generic advice — tied to this brand's specific data gaps).
9. Be direct and analytical. No marketing fluff. No sycophancy. Do not mention XanLens or Content Fixes.
10. Use markdown formatting: ## for title, **bold** for key metrics and emphasis, bullet points for lists. Make it scannable.`;

            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${GEMINI_KEY}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ role: "user", parts: [{ text: narrativePrompt }] }],
                  generationConfig: { temperature: 0.4, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 1024 } },
                }),
                signal: AbortSignal.timeout(30000),
              }
            );
            if (geminiRes.ok) {
              const geminiData = await geminiRes.json();
              const parts = geminiData?.candidates?.[0]?.content?.parts || [];
              const narrativeText = parts.filter((p: any) => p.text && !p.thought).map((p: any) => p.text).join("\n") || null;
              if (narrativeText) {
                cached.narrative = narrativeText;
                await redisSet(narrativeCacheKey, narrativeText, 90 * 86400);
                // Update main cache
                redisSet(`audit:${jobId}:scored:v32`, JSON.stringify(cached), 3600).catch(() => {});
                redisSet(`audit:result:${jobId}`, JSON.stringify(cached), 90 * 86400).catch(() => {});
              }
            }
          }
        }
      } catch (e) {
        console.warn("[NARRATIVE_CACHED] Failed:", e);
      }
    }

    return NextResponse.json(cached);
  }

  const doneRaw = await redisGet(`audit:${jobId}:done`);
  const done = parseInt(doneRaw || "0", 10);

  // Allow completion at 90%+ to handle stragglers (timeouts that never increment done)
  const completionRatio = totalWorkers > 0 ? done / totalWorkers : 0;
  if (completionRatio < 0.9) {
    return NextResponse.json({
      status: "processing",
      job_id: jobId,
      brand,
      done,
      total: totalWorkers,
      progress: Math.round(completionRatio * 100),
    });
  }

  // Read the plan early — needed for grounded check and response fetching
  const planRaw = await redisGet(`audit:${jobId}:plan`);
  const plan: Array<{ engine: string; prompt: string; promptIndex: number; persona?: string; category?: string }> = planRaw ? JSON.parse(planRaw) : [];

  // Wait for grounded results — they're slower (Pro uses grounding with Google Search)
  const groundedPlanItems = plan.filter(p => p.engine === "gemini_grounded");
  if (groundedPlanItems.length > 0) {
    const groundedKeys = groundedPlanItems.map(p => `audit:${jobId}:gemini_grounded:p:${p.promptIndex}`);
    const groundedResults = await Promise.all(groundedKeys.map(k => redisGet(k)));
    const groundedReady = groundedResults.filter(r => r !== null).length;
    // Need at least 80% of grounded results before scoring (they feed discoverability)
    if (groundedReady < groundedPlanItems.length * 0.8) {
      return NextResponse.json({
        status: "processing",
        job_id: jobId,
        brand,
        done,
        total: totalWorkers,
        progress: Math.min(95, Math.round(completionRatio * 100)),
        message: "Waiting for grounded search results...",
      });
    }
  }

  // Only fetch keys that actually exist per the plan
  const responseKeys: Array<{ engine: string; index: number; key: string }> = plan.map(item => ({
    engine: item.engine,
    index: item.promptIndex,
    key: `audit:${jobId}:${item.engine}:p:${item.promptIndex}`,
  }));
  // Build unique prompt index set to avoid redundant fetches
  const uniquePromptIndices = [...new Set(plan.map(p => p.promptIndex))].sort((a, b) => a - b);
  const uniquePromptKeys = uniquePromptIndices.map(i => `audit:${jobId}:prompt:${i}`);

  const [responseResults, uniquePromptTexts] = await Promise.all([
    Promise.all(responseKeys.map(k => redisGet(k.key))),
    Promise.all(uniquePromptKeys.map(k => redisGet(k))),
  ]);

  // Build promptIndex → text lookup
  const promptTextMap: Record<number, string> = {};
  uniquePromptIndices.forEach((idx, i) => {
    promptTextMap[idx] = uniquePromptTexts[i] || "";
  });

  // Parse responses
  const engineResponseMap: Record<string, string[]> = {};
  const engineTotalMap: Record<string, number> = {};
  const promptDetails: Array<{
    prompt: string;
    engine: string;
    engine_model: string;
    source_type: string;
    category: string;
    mentioned: boolean;
    blind_spot: boolean;
    snippet: string | null;
    full_response: string | null;
    citations: string[];
    judgeGenuine?: boolean;
    judgeConfidence?: number;
  }> = [];
  const allCitations: string[] = [];
  let blindSpotCount = 0;

  for (let r = 0; r < responseKeys.length; r++) {
    const { engine, index } = responseKeys[r];
    const raw = responseResults[r];
    if (!raw) continue;

    const parsed = JSON.parse(raw);
    const response = sanitizeText(parsed.response || "");
    // Parse prompt — may be plain string or JSON { text, persona }
    const rawPrompt = promptTextMap[index] || `Prompt #${index + 1}`;
    let promptText = rawPrompt;
    let persona: string | undefined;
    try {
      const parsed = JSON.parse(rawPrompt);
      if (parsed.text) { promptText = parsed.text; persona = parsed.persona; }
    } catch { /* plain string */ }

    const planItem = plan.find(p => p.engine === engine && p.promptIndex === index);
    const promptCategory = planItem?.category || "category";

    engineTotalMap[engine] = (engineTotalMap[engine] || 0) + 1;

    if (response) {
      if (!engineResponseMap[engine]) engineResponseMap[engine] = [];
      engineResponseMap[engine].push(response);

      const analysis = analyzeMentions(response, brand, website, promptText, descriptionKeywords);
      console.log(`[JUDGE_DEBUG] brand="${brand}" engine=${engine} prompt="${promptText?.slice(0,50)}" genuine=${analysis.genuine} mentions=${analysis.mentions} kw_count=${descriptionKeywords.length}`);
      const citations = extractCitations(response, brand, website);
      // Blind spot = brand not mentioned in a non-branded prompt
      // (branded prompts like "What is X?" should always mention X, so not a blind spot)
      const blind = !analysis.genuine && promptCategory !== "brand";

      if (blind) blindSpotCount++;
      allCitations.push(...citations);

      promptDetails.push({
        prompt: promptText,
        engine,
        engine_model: ENGINE_MODEL_NAMES[engine] || engine,
        source_type: ENGINE_SOURCE_TYPE[engine] || "training",
        category: promptCategory,
        mentioned: analysis.genuine,
        blind_spot: blind,
        snippet: analysis.genuine && analysis.snippets.length > 0 ? analysis.snippets[0] : null,
        full_response: response.slice(0, 8000),
        citations,
        ...(persona ? { persona } : {}),
      });
    } else {
      promptDetails.push({
        prompt: promptText,
        engine,
        engine_model: ENGINE_MODEL_NAMES[engine] || engine,
        source_type: ENGINE_SOURCE_TYPE[engine] || "training",
        category: promptCategory,
        mentioned: false,
        blind_spot: false,
        snippet: parsed.error ? `Error: ${parsed.error.slice(0, 100)}` : null,
        full_response: parsed.error ? `Error: ${parsed.error}` : null,
        citations: [],
        ...(persona ? { persona } : {}),
      });
    }
  }

  // ── LLM Judge: Detect wrong-entity mentions ──
  // Build product description for the judge from stored meta — MUST be rich enough
  // to distinguish the real product from other products sharing the same name.
  const descParts: string[] = [];
  if (metaWebsiteContext) descParts.push(metaWebsiteContext); // Full scraped website content for grounding
  if (metaDescription && !metaWebsiteContext) descParts.push(metaDescription); // Fallback if no website context
  const featureKw = ((metaFeatures || []) as string[]).concat((metaKeywords || []) as string[]).filter(Boolean);
  if (featureKw.length > 0) descParts.push(`Key features/keywords: ${featureKw.join(", ")}`);
  if (industry) descParts.push(`Industry: ${industry}`);
  if (website) descParts.push(`Website: ${website}`);
  const productDescription = descParts.join(". ") || `${brand} — ${industry || "technology"}`;

  // Collect ALL genuine mentions for judging — the LLM judge runs on every mention
  // LLM Judge runs on ALL responses (not just keyword-matched) — the judge is the
  // authoritative decision maker. Keyword matching is just a fast hint.
  const rejectedResponses = new Set<string>(); // hash of rejected response text
  if (promptDetails.length > 0) {
    const toJudge: Array<{ index: number; response: string; brand: string; productDescription: string; website?: string; industry?: string; promptCategory?: string }> = [];
    for (let i = 0; i < promptDetails.length; i++) {
      const pd = promptDetails[i];
      // Send ALL non-empty responses to the judge — not just keyword-matched ones
      // The judge catches both false positives (keyword matched wrong entity) and
      // false negatives (AI used a name variation the keyword matcher missed)
      if (pd.full_response && pd.full_response.length > 50) {
        toJudge.push({ index: i, response: pd.full_response, brand, productDescription, website, industry, promptCategory: pd.category });
      }
    }

    // Split into two priority tiers:
    // 1. Items keyword-matched as mentioned → check for false positives (most important)
    // 2. Items NOT mentioned → check for false negatives (if time permits)
    const mentionedToJudge = toJudge.filter(item => promptDetails[item.index].mentioned);
    const unmatchedToJudge = toJudge.filter(item => !promptDetails[item.index].mentioned);
    console.log(`[JUDGE_DEBUG] brand="${brand}" mentioned=${mentionedToJudge.length} unmatched=${unmatchedToJudge.length} productDesc="${productDescription?.slice(0,80)}" kw_count=${descriptionKeywords.length}`);
    if (toJudge.length > 0) {
      // Apply judge results incrementally via callback — even if the batch
      // times out, completed items still get their corrections applied.
      const applyJudgment = (idx: number, judgment: { genuine: boolean; confidence: number }) => {
        const pd = promptDetails[idx];
        console.log(`[JUDGE_DEBUG] idx=${idx} engine=${pd.engine} keyword_mentioned=${pd.mentioned} judge_genuine=${judgment.genuine} conf=${judgment.confidence}`);
        pd.judgeGenuine = judgment.genuine;
        pd.judgeConfidence = judgment.confidence;
        if (judgment.confidence > 0) {
          if (judgment.genuine && !pd.mentioned) {
            pd.mentioned = true;
            const respLower = (pd.full_response || "").toLowerCase();
            const brandLower = brand.toLowerCase();
            const snippetIdx = respLower.indexOf(brandLower);
            if (snippetIdx > -1) {
              pd.snippet = (pd.full_response || "").slice(Math.max(0, snippetIdx - 50), snippetIdx + 200).trim();
            } else {
              pd.snippet = (pd.full_response || "").slice(0, 200).trim();
            }
          } else if (!judgment.genuine && pd.mentioned) {
            pd.mentioned = false;
            pd.snippet = null;
            const respText = pd.full_response;
            if (respText) rejectedResponses.add(respText.slice(0, 200));
          }
        }
      };

      // Phase 1: Judge all mentioned items (false positive elimination)
      try {
        const phase1Promise = batchJudgeMentions(mentionedToJudge, 10, applyJudgment);
        await Promise.race([
          phase1Promise,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Judge phase1 timeout")), 80000)),
        ]);
      } catch (e) {
        console.warn("[LLM Judge] Phase 1 timed out — partial results applied:", e);
      }

      // Phase 2: false negative recovery
      if (unmatchedToJudge.length > 0) {
        try {
          const phase2Promise = batchJudgeMentions(unmatchedToJudge, 10, applyJudgment);
          await Promise.race([
            phase2Promise,
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Judge phase2 timeout")), 30000)),
          ]);
        } catch {
          console.warn("[LLM Judge] Phase 2 (FN recovery) timed out — partial results applied");
        }
      }
    }
  }

  // Score each engine using per-prompt weighted scoring
  const engineResults: Record<string, any> = {};
  const aiScores: number[] = [];

  // Build per-engine response arrays with category info
  const enginePromptData: Record<string, Array<{ response: string; category: string; prompt: string }>> = {};
  for (let r = 0; r < responseKeys.length; r++) {
    const { engine, index } = responseKeys[r];
    const raw = responseResults[r];
    if (!raw) continue;
    const parsed = JSON.parse(raw);
    const response = sanitizeText(parsed.response || "");
    // For grounded engine: always include (even empty) so discoverability counts total correctly
    // For other engines: skip empty responses (they don't affect knowledge scoring)
    if (!response && engine !== "gemini_grounded") continue;
    const planItem = plan.find(p => p.engine === engine && p.promptIndex === index);
    const category = planItem?.category || "category";
    const promptText = promptTextMap[index] || "";
    if (!enginePromptData[engine]) enginePromptData[engine] = [];
    enginePromptData[engine].push({ response, category, prompt: promptText });
  }

  for (const [eng, total] of Object.entries(engineTotalMap)) {
    if (eng === "gemini_grounded") continue; // scored separately for discoverability
    const data = enginePromptData[eng] || [];
    // Filter out LLM-judge-rejected responses by blanking them
    const filteredData = data.map(d => {
      if (rejectedResponses.size > 0 && d.response && rejectedResponses.has(d.response.slice(0, 200))) {
        return { ...d, response: "" }; // blanked → analyzeMentions returns 0
      }
      return d;
    });
    const result = scoreEngineResponses(filteredData, brand, website, descriptionKeywords);
    // Score reflects quality of responses received — no penalty for API timeouts
    // (timeouts are infrastructure issues, not brand visibility issues)
    engineResults[eng] = {
      score: result.score,
      mentions: result.mentions,
      sentiment: result.sentiment,
      sample_snippets: result.snippets,
      prompts_tested: data.length,
      prompts_total: total,
      model_name: ENGINE_MODEL_NAMES[eng] || eng,
      source_type: ENGINE_SOURCE_TYPE[eng] || "training",
      reliability: total > 0 ? Math.round((data.length / total) * 100) : 0,
    };
    aiScores.push(result.score);
  }

  // Paused engines — show as unavailable in report
  const PAUSED_ENGINES = [
    { key: "perplexity", model: "Perplexity" },
    { key: "gpt4o", model: "GPT-4o" },
    { key: "claude", model: "Claude" },
    { key: "llama", model: "Llama" },
    { key: "qwen", model: "Qwen" },
  ];
  for (const pe of PAUSED_ENGINES) {
    if (!engineResults[pe.key]) {
      engineResults[pe.key] = {
        score: 0,
        mentions: 0,
        sentiment: "unknown",
        sample_snippets: [],
        prompts_tested: 0,
        prompts_total: 0,
        unavailable: true,
        status: "paused",
        model_name: pe.model,
      };
    }
  }

    // Base engine score (pure mentions)
  const rawEngineScore = aiScores.length > 0
    ? Math.round(aiScores.reduce((a, b) => a + b, 0) / aiScores.length)
    : 0;

  // Awareness bonus: if engines give substantive responses about the category
  // but don't name the brand, that's not a zero — there's opportunity.
  // Count responses that are long/substantive but NOT "I don't know" responses.
  // Filter out gemini_grounded from knowledge awareness calculation
  const knowledgePromptDetails = promptDetails.filter(p => p.engine !== "gemini_grounded");
  const awarenessCount = knowledgePromptDetails.filter((p: Record<string, unknown>) => {
    if (p.mentioned) return false;
    const resp = (p.full_response as string) || '';
    if (resp.length < 150) return false;
    if (BLIND_SPOT_PATTERNS.some(pat => pat.test(resp))) return false;
    return true;
  }).length;
  const totalPrompts = knowledgePromptDetails.length;
  const awarenessRatio = totalPrompts > 0 ? awarenessCount / totalPrompts : 0;
  // Awareness contributes up to 12 points (category is known, brand isn't)
  const awarenessBonus = Math.round(awarenessRatio * 12);

  // ── Cross-engine consistency (GPT-5.2 formula) ──
  // Count how many distinct engines confirmed at least one mention
  const enginesWithMentions = new Set<string>();
  for (const pd of knowledgePromptDetails) {
    if (pd.mentioned && pd.engine) enginesWithMentions.add(pd.engine as string);
  }
  const confirmedEngines = enginesWithMentions.size;
  const totalEngines = new Set(knowledgePromptDetails.map((p: Record<string, unknown>) => p.engine as string)).size;
  // Single-engine mentions get ×0.7, multi-engine scale up to ×1.0
  const consistencyMultiplier = totalEngines <= 1 ? 1.0 : (confirmedEngines <= 1 ? 0.7 : 0.7 + 0.3 * ((confirmedEngines - 1) / (totalEngines - 1)));
  const knowledge_score = Math.min(100, Math.round((rawEngineScore + awarenessBonus) * consistencyMultiplier));

  // ── Discoverability Score from gemini_grounded engine results ──
  const brandLower = brand.toLowerCase();
  const brandDomainForCite = website ? (() => { try { return new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, ""); } catch { return ""; } })() : "";

  // Parse grounded responses — extract sources from |||SOURCES||| delimiter
  const groundedResponses = enginePromptData["gemini_grounded"] || [];
  const allGroundedSources: Array<{ title: string; url: string; content: string }> = [];
  const groundedTexts: string[] = [];
  const groundedPromptDetails: Array<{ prompt: string; text: string; mentioned: boolean; sources: Array<{ title: string; url: string; content: string }>; category?: string }> = [];

  for (const gd of groundedResponses) {
    let text = gd.response;
    let sources: Array<{ title: string; url: string; content: string }> = [];
    if (text.includes("|||SOURCES|||")) {
      const parts = text.split("|||SOURCES|||");
      text = parts[0];
      try { sources = JSON.parse(parts[1]); } catch { /* ignore */ }
    }
    groundedTexts.push(text);
    allGroundedSources.push(...sources);
    const fullText = text + " " + sources.map(s => s.title + " " + s.content).join(" ");
    const analysis = analyzeMentions(fullText, brand, website, gd.prompt, descriptionKeywords);
    groundedPromptDetails.push({ prompt: gd.prompt, text, mentioned: analysis.genuine, sources, category: gd.category });
  }

  // ── LLM Judge for grounded results (same as training data judge) ──
  if (groundedPromptDetails.length > 0) {
    const groundedToJudge: Array<{ index: number; response: string; brand: string; productDescription: string; website?: string; industry?: string; promptCategory?: string }> = [];
    for (let i = 0; i < groundedPromptDetails.length; i++) {
      const gd = groundedPromptDetails[i];
      if (gd.mentioned && gd.text) {
        groundedToJudge.push({ index: i, response: gd.text.slice(0, 8000), brand, productDescription, website, industry, promptCategory: gd.category });
      }
    }
    if (groundedToJudge.length > 0) {
      try {
        const groundedCallback = (idx: number, judgment: { genuine: boolean; confidence: number }) => {
          if (!judgment.genuine && judgment.confidence > 0) {
            groundedPromptDetails[idx].mentioned = false;
          }
        };
        await Promise.race([
          batchJudgeMentions(groundedToJudge, 10, groundedCallback),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Grounded judge timeout")), 50000)
          ),
        ]);
      } catch (e) {
        console.warn("[LLM Judge] Grounded batch timed out — partial results applied:", e);
      }
    }
  }

  // Discoverability score = same methodology as knowledge: % of grounded prompts that mention brand
  const groundedMentioned = groundedPromptDetails.filter(g => g.mentioned).length;
  const groundedTotal = groundedPromptDetails.length;
  // Jeffreys prior Beta(0.5,0.5) — avoids 0% and 100% extremes (GPT-5.2 formula)
  const discoverability_score = groundedTotal > 0
    ? Math.min(100, Math.round(((groundedMentioned + 0.5) / (groundedTotal + 1)) * 100))
    : 0;

  // Citation score from all grounded sources
  const uniqueSources = allGroundedSources.filter((s, i, arr) => arr.findIndex(x => x.url === s.url) === i);
  const brandSourceCount = uniqueSources.filter(s =>
    s.title.toLowerCase().includes(brandLower) || s.url.includes(brandDomainForCite)
  ).length;
  // Half-saturation citation curve at 8 domains (GPT-5.2 formula)
  // 1 source → 8%, 4 → 29%, 8 → 50%, 16 → 75%, 32 → 94%
  const citationScore = brandSourceCount > 0
    ? Math.min(100, Math.round(100 * (1 - Math.pow(2, -brandSourceCount / 8))))
    : 0;

  // Build grounded_data for the response
  const groundedBrandFound = groundedMentioned > 0;
  const groundedResult = {
    queries: groundedPromptDetails.map(g => ({ prompt: g.prompt, text: g.text, mentioned: g.mentioned, sources: g.sources })),
    text: groundedTexts.join("\n\n---\n\n"),
    sources: uniqueSources,
    brand_found: groundedBrandFound,
  };

  // ── GPT-5.2 Full Scoring Formula (v2) ──
  // K+D = "does AI know you" (core score). C = "does AI link to you" (additive bonus).
  // Synergy only couples K and D — citation never penalizes.
  const hasGrounded = groundedTotal > 0;
  const k = knowledge_score / 100;
  const d = hasGrounded ? discoverability_score / 100 : k;
  const c = citationScore / 100;

  // OV_base = 0.60K + 0.35D + 0.05C
  const OV_base = hasGrounded
    ? 0.60 * knowledge_score + 0.35 * discoverability_score + 0.05 * citationScore
    : 0.90 * knowledge_score + 0.10 * citationScore; // no grounded fallback

  // Synergy: φ = 0.80 + 0.20 × √(k × d) — only K and D, citation excluded
  const synergy = 0.80 + 0.20 * Math.sqrt(k * d);
  const OV = OV_base * synergy;

  // Citation bonus: +5 points max (additive, not multiplicative)
  const citationBonus = 5 * c;

  const overallScore = Math.round(Math.max(0, Math.min(100, OV + citationBonus)));
  const grade = overallScore >= 90 ? "A"
    : overallScore >= 75 ? "B"
    : overallScore >= 60 ? "C"
    : overallScore >= 40 ? "D" : "F";

  const tested = promptDetails.length;
  const mentionedIn = promptDetails.filter(p => p.mentioned).length;
  const coveragePct = tested > 0 ? Math.round((mentionedIn / tested) * 100) : 0;

  // ── Citation source aggregation + classification ──
  const AUTHORITY_PATTERNS = [
    /wikipedia\.org/i, /\.gov$/i, /\.edu$/i, /\.gov\./i, /\.edu\./i,
    /reuters\.com/i, /bbc\.com/i, /nytimes\.com/i, /wsj\.com/i, /forbes\.com/i,
    /techcrunch\.com/i, /theverge\.com/i, /wired\.com/i, /bloomberg\.com/i,
    /nature\.com/i, /sciencedirect\.com/i, /arxiv\.org/i, /pubmed\.ncbi/i,
    /youtube\.com/i, /youtu\.be/i, /github\.com/i,
  ];

  function classifyCitationDomain(domain: string): "authority" | "competitor" | "other" {
    if (AUTHORITY_PATTERNS.some(p => p.test(domain))) return "authority";
    return "other";
  }

  const citationCounts: Record<string, number> = {};
  const citationTypes: Record<string, string> = {};
  for (const url of allCitations) {
    try {
      const domain = new URL(url).hostname.replace(/^www\./, "");
      citationCounts[domain] = (citationCounts[domain] || 0) + 1;
      if (!citationTypes[domain]) citationTypes[domain] = classifyCitationDomain(domain);
    } catch { /* skip malformed URLs */ }
  }

  // Check if brand's own domain is in citations
  const brandDomain = website ? new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "") : "";
  const brandCited = brandDomain ? !!citationCounts[brandDomain] : false;

  // Citation gap: only show domains that are ACTUAL competitors (from meta.competitors)
  // or high-frequency non-authority domains. Filters out random URLs like heightmap.skydark.pl
  const competitorDomains: Set<string> = new Set(
    ((meta.competitors || []) as string[]).map((c: string) => c.toLowerCase().replace(/\s+/g, ""))
  );
  const citationGap = Object.entries(citationCounts)
    .filter(([domain]) => {
      if (domain === brandDomain) return false;
      if (citationTypes[domain] === "authority") return false;
      // Keep if domain matches a known competitor name
      const domainLower = domain.toLowerCase();
      for (const comp of competitorDomains) {
        if (domainLower.includes(comp) || comp.includes(domainLower.split(".")[0])) return true;
      }
      // Keep if cited 3+ times (significant enough regardless)
      const count = citationCounts[domain];
      return count >= 3;
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain, count]) => ({ domain, count, type: citationTypes[domain] || "other" }));

  // Filter out internal/artifact domains and classify brand's own domain
  const CITATION_FILTER_DOMAINS = new Set([
    "vertexaisearch.cloud.google.com",  // Gemini Grounded internal search URL
    "search.google.com",
    "www.google.com",
  ]);
  const topCitations = Object.entries(citationCounts)
    .filter(([domain]) => !CITATION_FILTER_DOMAINS.has(domain))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({
      domain,
      count,
      type: domain === brandDomain ? "own" : (citationTypes[domain] || "other"),
    }));

  // ── Content gaps / blind spots (enhanced) ──
  const BLINDSPOT_TYPE_PATTERNS: Array<{ type: string; pattern: RegExp }> = [
    { type: "brand_unknown", pattern: /^(what is|who is|tell me about|is .* good)/i },
    { type: "product_unknown", pattern: /^(how to|how do|features|does .* offer|api|integration)/i },
    { type: "category_unknown", pattern: /^(best|top|leading|recommend|comparison)/i },
    { type: "outdated_info", pattern: /^(review|experience|2025|latest|current)/i },
  ];

  function classifyBlindspot(prompt: string): { type: string; severity: "critical" | "high" | "medium" } {
    for (const { type, pattern } of BLINDSPOT_TYPE_PATTERNS) {
      if (pattern.test(prompt)) {
        const severity = type === "brand_unknown" ? "critical" : type === "product_unknown" ? "high" : "medium";
        return { type, severity };
      }
    }
    return { type: "brand_unknown", severity: "high" };
  }

  const blindSpotDetails = promptDetails
    .filter(d => d.blind_spot)
    .map(d => {
      // Use actual prompt category for type classification instead of regex
      const CATEGORY_TO_BLINDSPOT: Record<string, { type: string; severity: "critical" | "high" | "medium" }> = {
        category: { type: "category_unknown", severity: "high" },
        discovery: { type: "product_unknown", severity: "high" },
        buying_intent: { type: "category_unknown", severity: "critical" },
        competitor: { type: "category_unknown", severity: "medium" },
        conversational: { type: "product_unknown", severity: "medium" },
      };
      const classification = CATEGORY_TO_BLINDSPOT[d.category] || classifyBlindspot(d.prompt);
      return { prompt: d.prompt, engine: d.engine, type: classification.type, severity: classification.severity };
    });
  const blindSpots = blindSpotDetails.map(d => d.prompt);

  // ── Trend comparison: load + store history ──
  const bHash = brandHash(brand, website);
  const historyKey = `history:${bHash}`;
  let previousScore: number | null = null;
  let scoreDelta: number | null = null;
  let trend: "improving" | "declining" | "stable" | "new" = "new";
  let fullHistory: Array<{ date: string; score: number; grade: string }> = [];
  let categoryComparison: Record<string, string> = {};

  try {
    const histRaw = await redisGet(historyKey);
    const history: Array<{ date: string; score: number; grade: string }> = histRaw ? JSON.parse(histRaw) : [];
    fullHistory = history;

    if (history.length > 0) {
      const prev = history[history.length - 1];
      previousScore = prev.score;
      scoreDelta = overallScore - previousScore;
      // ±10 point margin for AI non-determinism
      if (Math.abs(scoreDelta) <= 10) trend = "stable";
      else if (scoreDelta > 0) trend = "improving";
      else trend = "declining";
    }

    // Append current score (keep last 20 entries, 90 day TTL)
    const newEntry = { date: new Date().toISOString().split("T")[0], score: overallScore, grade };
    const updated = [...history.slice(-19), newEntry];
    await redisSet(historyKey, JSON.stringify(updated), 7776000); // 90 days
  } catch { /* history is best-effort */ }

  // ── Search Volume Enrichment (Pro audits only — costs $0.05/batch) ──
  // DISABLED: conserving DataForSEO credits ($0.80 remaining). Set VOLUME_ENABLED=1 to activate.
  const source = req.nextUrl.searchParams.get("source");
  const isPro = metaTier === "pro" || metaTier === "coupon" || source !== "website"; // meta tier takes priority
  const volumeEnabled = process.env.VOLUME_ENABLED === "1";
  let totalMissedVolume = 0;

  if (isPro && volumeEnabled) {
    try {
      const uniquePrompts = [...new Set(promptDetails.map(d => d.prompt))];
      const volumeData = await getSearchVolumes(uniquePrompts);

      // Enrich prompt details with volume
      for (const detail of promptDetails) {
        const vol = volumeData[detail.prompt.toLowerCase().trim()];
        if (vol) {
          (detail as any).search_volume = vol.search_volume;
          (detail as any).cpc = vol.cpc;
          (detail as any).competition = vol.competition;
          if (!detail.mentioned && vol.search_volume) {
            totalMissedVolume += vol.search_volume;
          }
        }
      }
    } catch { /* volume is best-effort */ }
  }

  // ── Competitor Analysis (Pro only) ──
  let competitorAnalysis: {
    share_of_voice: number;
    your_mentions: number;
    competitors: Array<{ name: string; mentions: number; sentiment: string; visibility: number }>;
  } | undefined;

  if (isPro && meta.competitors && meta.competitors.length > 0) {
    // For SOV: exclude branded prompts to avoid inflating brand's share
    // (branded prompts like "What is X?" will always mention X 100%)
    const nonBrandedResponses = promptDetails
      .filter(d => d.category !== "brand" && d.full_response)
      .map(d => d.full_response!)
      .join("\n\n");
    const allResponseText = nonBrandedResponses || Object.values(engineResponseMap).flat().join("\n\n");
    const brandMentions = analyzeMentions(allResponseText, brand, website, undefined, descriptionKeywords);

    // Analyze competitor mentions, then judge for wrong-entity (e.g., ai16z vs a16z)
    const compResultsRaw = meta.competitors.map((comp: string) => {
      const analysis = analyzeMentions(allResponseText, comp);
      return { name: comp, mentions: analysis.mentions, sentiment: analysis.sentiment };
    });

    // Competitor wrong-entity judge: for each competitor with mentions,
    // check if the AI is actually talking about the right entity.
    // Uses a lightweight heuristic: extract sentences mentioning the competitor
    // and check if they describe a fundamentally different entity.
    const compResults = await Promise.all(compResultsRaw.map(async (comp: { name: string; mentions: number; sentiment: string }) => {
      if (comp.mentions === 0) return comp;
      // Extract sentences mentioning this competitor for judging
      const compLower = comp.name.toLowerCase();
      const compNospace = compLower.replace(/\s+/g, "");
      const sentences = allResponseText.split(/[.!?\n]+/)
        .filter(s => {
          const sl = s.toLowerCase();
          return sl.includes(compLower) || sl.includes(compNospace);
        })
        .slice(0, 10)
        .join(". ");
      if (!sentences) return comp;

      // Use LLM judge to verify — but we need a product description for the competitor.
      // We don't have one, so use a simpler heuristic: check if the response context
      // matches the brand's industry. If competitor is "ai16z" but response talks about
      // "venture capital firm" or "Andreessen Horowitz", it's a wrong entity.
      try {
        const judgeResult = await llmJudgeMention(
          sentences,
          comp.name,
          `${comp.name} is a competitor of ${brand} in the ${meta.industry || "technology"} industry. ${meta.description || ""}`,
        );
        if (!judgeResult.genuine && judgeResult.confidence > 0) {
          console.log(`[COMP_JUDGE] "${comp.name}" rejected — wrong entity (conf=${judgeResult.confidence})`);
          return { ...comp, mentions: 0, sentiment: "unknown" as const };
        }
      } catch (e) {
        console.warn(`[COMP_JUDGE] Error judging "${comp.name}":`, e);
      }
      return comp;
    }));

    // Calculate share of voice
    const totalMentions = brandMentions.mentions + compResults.reduce((s: number, c: { mentions: number }) => s + c.mentions, 0);
    const shareOfVoice = totalMentions > 0 ? Math.round((brandMentions.mentions / totalMentions) * 100) : 0;

    // Calculate visibility per competitor (same method as brand scoring)
    const compWithVisibility = compResults.map((c: { name: string; mentions: number; sentiment: string }) => {
      const vis = totalMentions > 0 ? Math.round((c.mentions / totalMentions) * 100) : 0;
      return { ...c, visibility: vis };
    }).sort((a: { mentions: number }, b: { mentions: number }) => b.mentions - a.mentions);

    competitorAnalysis = {
      share_of_voice: shareOfVoice,
      your_mentions: brandMentions.mentions,
      competitors: compWithVisibility,
    };
  } else if (isPro) {
    // No competitors detected — still return the object so the "emerging category" UI renders
    competitorAnalysis = { share_of_voice: 100, your_mentions: 0, competitors: [] };
  }

  // ── LLM Narrative (Gemini 3 Flash) ──
  let narrative: string | null = null;
  try {
    const narrativeCacheKey = `audit:${jobId}:narrative`;
    const cachedNarrative = await redisGet(narrativeCacheKey);
    if (cachedNarrative) {
      narrative = cachedNarrative;
    } else if (isPro) {
      const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
      if (GEMINI_KEY) {
        const activeEngineEntries2 = Object.entries(engineResults).filter(([, e]: [string, any]) => !e.unavailable && e.status !== "paused");
        const pausedEngineEntries2 = Object.entries(engineResults).filter(([, e]: [string, any]) => e.unavailable || e.status === "paused");
        const engineSummary = activeEngineEntries2.map(([name, e]: [string, any]) =>
          `${ENGINE_MODEL_NAMES[name] || name}: score ${e.score}/100, ${e.mentions} mentions in ${e.prompts_total} prompts`
        ).join("; ");
        const pausedNote2 = pausedEngineEntries2.length > 0
          ? `\n- Paused engines (NOT included in scoring, currently in beta): ${pausedEngineEntries2.map(([name]) => ENGINE_MODEL_NAMES[name] || name).join(", ")}`
          : "";
        const compSummary = competitorAnalysis?.competitors?.map((c: any) => `${c.name}: ${c.mentions} mentions, ${c.visibility}% visibility`).join("; ") || "none detected";
        const catSummary = Object.entries(
          promptDetails.reduce((acc: Record<string, { total: number; mentioned: number }>, d) => {
            const cat = d.category || "other";
            if (!acc[cat]) acc[cat] = { total: 0, mentioned: 0 };
            acc[cat].total++;
            if (d.mentioned) acc[cat].mentioned++;
            return acc;
          }, {})
        ).map(([cat, v]) => `${cat}: ${v.mentioned}/${v.total} (${Math.round((v.mentioned / v.total) * 100)}%)`).join("; ");

        const narrativePrompt = `You are a senior AI visibility strategist writing an executive report for ${brand} (${website}).

AUDIT DATA:
- Overall GEO Score: ${overallScore}/100 (Grade ${grade})
- Knowledge Score: ${knowledge_score}/100 (how well AI training data knows the brand)
- Discoverability Score: ${discoverability_score}/100 (how well grounded/search-based AI finds the brand)
- Citation Score: ${citationScore}/100
- Active engines tested: ${engineSummary}${pausedNote2}
- Prompt coverage by category: ${catSummary}
- Competitors (share of voice from non-branded prompts): ${compSummary}
- Brand SOV: ${competitorAnalysis?.share_of_voice ?? "N/A"}%
- Blind spots: ${blindSpotDetails.length} prompts where brand was not mentioned
- Industry: ${industry}

SCORING METHODOLOGY:
- Knowledge Score = how well AI engines know the brand from training data. Only ACTIVE engines are scored — paused engines are excluded entirely from calculations.
- Discoverability Score = how well grounded/real-time AI search finds the brand. High = Google-connected AI finds the brand when searching.
- GEO Score = weighted: 55% Knowledge + 25% Discoverability + 20% Citation, with synergy bonuses.
- Share of Voice = % of total mentions in NON-branded prompts. Organic competitive standing.
- Blind spots = non-branded prompts where the brand was NOT mentioned at all.

WRITING RULES:
1. Start with a bold title summarizing the brand's AI visibility status (e.g., "## Strong Discoverability, Weak Knowledge" or "## Invisible to AI Engines").
2. Follow with a one-line verdict in plain English.
3. Write 3-4 short paragraphs. Use bullet points where listing multiple items (engines, categories, gaps). Keep paragraphs tight — 2-4 sentences max. Add line breaks between sections for readability.
4. Be specific — cite actual scores, engine names, and category percentages. Don't be vague.
5. Explain metric relationships (e.g., "high discoverability but low knowledge means search-connected AI finds you but parametric models haven't absorbed your brand yet").
6. Only discuss ACTIVE engines. Do NOT mention paused/unavailable engines or claim they scored 0 — they were not tested.
7. Identify the **#1 biggest opportunity** and the **#1 biggest risk** — use bold for emphasis.
8. End with a "What to do next" section with 2-3 concrete bullet points (not generic advice — tied to this brand's specific data gaps).
9. Be direct and analytical. No marketing fluff. No sycophancy. Do not mention XanLens or Content Fixes.
10. Use markdown formatting: ## for title, **bold** for key metrics and emphasis, bullet points for lists. Make it scannable.`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${GEMINI_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: narrativePrompt }] }],
              generationConfig: { temperature: 0.4, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 1024 } },
            }),
            signal: AbortSignal.timeout(30000),
          }
        );
        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          // Gemini 3.1 Pro returns thinking + text parts — extract only text parts
          const parts = geminiData?.candidates?.[0]?.content?.parts || [];
          narrative = parts.filter((p: any) => p.text && !p.thought).map((p: any) => p.text).join("\n") || null;
          if (narrative) {
            await redisSet(narrativeCacheKey, narrative, 90 * 86400); // cache 90 days
          }
        }
      }
    }
  } catch (e) {
    console.warn("[NARRATIVE] Failed to generate:", e);
  }

  // ── Nudges ──
  const nudges: Array<{ type: string; urgency: string; reason: string; date?: string }> = [];

  const nextDays = overallScore >= 75 ? 30 : 7;
  const nextAudit = new Date(Date.now() + nextDays * 86400000).toISOString().split("T")[0];

  // Re-audit nudge
  nudges.push({
    type: "re_audit",
    urgency: overallScore < 40 ? "high" : overallScore < 75 ? "medium" : "low",
    reason: `Re-audit ${overallScore >= 75 ? "in 30 days to monitor for drift" : "in 7 days to track improvement"}.`,
    date: nextAudit,
  });

  // Fix Kit nudge
  if (overallScore < 40) {
    nudges.push({ type: "fix_kit", urgency: "high", reason: `Score is ${overallScore}/100. Critical — run Fix Kit to generate optimization content immediately.` });
  } else if (trend === "declining" && scoreDelta !== null && scoreDelta < -10) {
    nudges.push({ type: "fix_kit", urgency: "high", reason: `Score dropped ${Math.abs(scoreDelta)} points (${previousScore} → ${overallScore}). Run Fix Kit to recover visibility.` });
  } else if (overallScore < 60) {
    nudges.push({ type: "fix_kit", urgency: "medium", reason: `Score is ${overallScore}/100. Fix Kit can help close visibility gaps.` });
  }

  // Update audit history record to "complete" with score
  if (jobWallet) {
    updateAuditStatus(jobWallet, jobId, "complete", overallScore).catch(() => {});
  }

  // Store full result for GEO Skill generation (expires in 90 days)
  const responseData = {
    status: "complete" as const,
    job_id: jobId,
    brand,
    website,
    industry,
    tier: metaTier || (isPro ? "pro" : "free"),
    overall_score: overallScore,
    knowledge_score,
    discoverability_score,
    citation_score: citationScore,
    grounded_data: groundedTotal > 0 ? {
      queries: groundedResult.queries,
      text: groundedResult.text,
      sources: groundedResult.sources,
      brand_found: groundedBrandFound,
      mentioned: groundedMentioned,
      total: groundedTotal,
    } : null,
    // debug fields removed for production
    estimated_monthly_revenue_impact: overallScore >= 80 ? "$25,000+/mo" : overallScore >= 60 ? "$5,000–25,000/mo" : overallScore >= 30 ? "$500–5,000/mo" : "$0–500/mo",
    score_confidence: "±8",
    grade,
    engines: engineResults,
    prompt_coverage: {
      coverage_pct: coveragePct,
      mentioned_in: mentionedIn,
      tested,
      details: promptDetails,
    },
    citations: {
      total: allCitations.length,
      top_sources: topCitations,
      all_urls: [...new Set(allCitations)].slice(0, 50),
      brand_cited: brandCited,
      citation_gap: isPro ? citationGap : undefined,
    },
    competitor_analysis: competitorAnalysis,
    blind_spots: {
      count: blindSpotDetails.length,
      prompts: isPro ? blindSpotDetails : blindSpots,
      by_type: isPro ? {
        brand_unknown: blindSpotDetails.filter(b => b.type === "brand_unknown").length,
        product_unknown: blindSpotDetails.filter(b => b.type === "product_unknown").length,
        category_unknown: blindSpotDetails.filter(b => b.type === "category_unknown").length,
        outdated_info: blindSpotDetails.filter(b => b.type === "outdated_info").length,
      } : undefined,
      critical_count: blindSpotDetails.filter(b => b.severity === "critical").length,
      message: blindSpotDetails.length > 0
        ? `AI engines explicitly don't know about your brand in ${blindSpotDetails.length} conversation types. These are your biggest opportunities.`
        : "No blind spots detected — AI engines have some knowledge of your brand.",
    },
    trend: {
      status: trend,
      previous_score: previousScore,
      delta: scoreDelta,
      history: isPro ? [...fullHistory, { date: new Date().toISOString().split("T")[0], score: overallScore, grade }] : undefined,
      message: trend === "new" ? "First audit for this brand."
        : trend === "stable" ? `Score stable (±${Math.abs(scoreDelta || 0)} points, within normal AI variation).`
        : trend === "improving" ? `Score improved by ${scoreDelta} points since last audit!`
        : `Score dropped ${Math.abs(scoreDelta || 0)} points since last audit. Consider running Fix Kit.`,
    },
    nudges,
    narrative,
    next_audit_recommended: nextAudit,
    search_volume: isPro && volumeEnabled ? {
      enabled: true,
      total_missed_volume: totalMissedVolume,
      message: totalMissedVolume > 0
        ? `You're missing from queries totaling ${totalMissedVolume.toLocaleString()} monthly searches.`
        : "Volume data enriched.",
    } : {
      enabled: false,
      message: isPro ? "Search volume analysis available." : "Upgrade to Pro to see search volume data for each prompt.",
    },
    done,
    total: totalWorkers,
    timestamp: new Date().toISOString(),
  };

  // Attach side-check results if available (from execute route)
  try {
    const [technicalRaw, aioRaw, seoRaw, contentRaw] = await Promise.all([
      redisGet(`audit:${jobId}:side:technical`),
      redisGet(`audit:${jobId}:side:aio`),
      redisGet(`audit:${jobId}:side:seo-score`),
      redisGet(`audit:${jobId}:side:content-optimizer`),
    ]);
    if (technicalRaw) (responseData as Record<string, unknown>).technical = JSON.parse(technicalRaw);
    if (aioRaw) (responseData as Record<string, unknown>).aio = JSON.parse(aioRaw);
    if (seoRaw) (responseData as Record<string, unknown>).seo_score = JSON.parse(seoRaw);
    if (contentRaw) (responseData as Record<string, unknown>).content_optimizer = JSON.parse(contentRaw);
  } catch {}

  // ── Website Health Checks (14 SEO/GEO checks) ──
  try {
    const healthCacheKey = `audit:${jobId}:health`;
    let healthRaw = await redisGet(healthCacheKey);
    if (!healthRaw) {
      const metaKeywords = (await redisGet(`audit:${jobId}:meta`).then(r => r ? JSON.parse(r) : null))?.keywords || [];
      const [healthResult, backlinkResult] = await Promise.all([
        auditWebsiteHealth(website, metaKeywords).catch(e => { console.warn("[HEALTH] Failed:", e); return null; }),
        discoverBacklinks(website, brand).catch(e => { console.warn("[BACKLINKS] Failed:", e); return null; }),
      ]);
      if (healthResult) {
        const healthData = { ...healthResult, backlinks: backlinkResult || { referringDomains: 0, categories: {}, topReferrers: [] } };
        healthRaw = JSON.stringify(healthData);
        const healthTTL = isPro ? 90 * 24 * 3600 : 7 * 24 * 3600;
        redisSet(healthCacheKey, healthRaw, healthTTL).catch(() => {});
      }
    }
    if (healthRaw) {
      (responseData as Record<string, unknown>).website_health = JSON.parse(healthRaw);
    }
  } catch (e) {
    console.warn("[HEALTH] Error in health audit:", e);
  }

  // Cache scored result so subsequent polls don't re-run the judge (1 hour TTL)
  redisSet(`audit:${jobId}:scored:v32`, JSON.stringify(responseData), 3600).catch(() => {});

  // Store result for report page + GEO Skill (90 day TTL for pro, 7 day for free)
  const resultTTL = isPro ? 90 * 24 * 3600 : 7 * 24 * 3600;
  redisSet(`audit:result:${jobId}`, JSON.stringify(responseData), resultTTL).catch(() => {});

  // ── Analytics: Store to Turso (awaited with timeout) ──
  try {
    const analyticsTimeout = new Promise<void>((resolve) => setTimeout(resolve, 5000));
    const analyticsWork = (async () => {
      const rd = responseData as Record<string, unknown>;
      const meta = await redisGet(`audit:${jobId}:meta`).then(r => r ? JSON.parse(r) : {}).catch(() => ({}));
      
      await storeAudit({
        jobId, brand, website,
        industry: meta.industry || undefined,
        description: meta.description || undefined,
        tier: isPro ? "pro" : "free",
        overallScore: overallScore,
        grade,
        knowledgeScore: rd.knowledge_score as number | undefined,
        discoverabilityScore: rd.discoverability_score as number | undefined,
        seoScore: (rd.seo_score as { score?: number })?.score ?? undefined,
        authorityScore: ((rd.technical as Record<string, unknown>)?.social_proof as { trust_score?: number })?.trust_score ?? undefined,
        features: meta.features,
        keywords: meta.keywords,
        competitors: meta.competitors as string[] | undefined,
      });
      console.log("[ANALYTICS] Stored audit record");

      const promptData = promptDetails.map((pd: Record<string, unknown>) => ({
        jobId, engine: String(pd.engine), prompt: String(pd.prompt),
        category: pd.category as string | undefined,
        mentioned: !!pd.mentioned,
        judgeGenuine: pd.judgeGenuine as boolean | undefined,
        judgeConfidence: pd.judgeConfidence as number | undefined,
        snippet: pd.snippet as string | undefined,
        fullResponse: pd.full_response as string | undefined,
      }));
      await storePrompts(promptData);
      console.log(`[ANALYTICS] Stored ${promptData.length} prompt records`);

      const sp = (rd.technical as Record<string, unknown>)?.social_proof as { sources?: Array<{ name: string; data: { exists: boolean; url?: string } }> } | undefined;
      if (sp?.sources) {
        await storeAuthority(sp.sources.map(s => ({
          jobId, sourceName: s.name, exists: s.data.exists, url: s.data.url,
        })));
        console.log(`[ANALYTICS] Stored ${sp.sources.length} authority records`);
      }

      const healthData = rd.website_health as Record<string, unknown> | undefined;
      const techData = rd.technical as Record<string, unknown> | undefined;
      const lh = techData?.lighthouse as Record<string, unknown> | undefined;
      const healthBacklinks = healthData?.backlinks as { referringDomains?: number; categories?: Record<string, number> } | undefined;
      await storeTechnical({
        jobId,
        lighthousePerf: lh?.performance_score as number | undefined,
        lighthouseSeo: lh?.seo_score as number | undefined,
        lighthouseA11y: lh?.accessibility_score as number | undefined,
        lighthouseBp: lh?.best_practices_score as number | undefined,
        ...(healthData?.raw as Record<string, unknown> || {}),
        backlinkReferringDomains: healthBacklinks?.referringDomains,
        backlinkCategories: healthBacklinks?.categories,
      } as Parameters<typeof storeTechnical>[0]);
      console.log("[ANALYTICS] Stored technical record");
    })();
    await Promise.race([analyticsWork, analyticsTimeout]);
  } catch (e) {
    console.warn("[ANALYTICS] Error storing to Turso:", e);
  }

  // Add session token for dashboard access
  if (meta.wallet) {
    try {
      const sessionToken = await getOrCreateSessionToken(meta.wallet);
      (responseData as Record<string, unknown>).session_token = sessionToken;
      (responseData as Record<string, unknown>).dashboard_url = `https://xanlens.com/dashboard?token=${sessionToken}`;
    } catch { /* non-critical */ }
  }

  // Add report URL and share prompt to response
  const reportUrl = `https://xanlens.com/report/${jobId}`;
  (responseData as Record<string, unknown>).report_url = reportUrl;
  (responseData as Record<string, unknown>).share = {
    message: `Share your GEO score on X to get a free re-audit coupon! Post your score mentioning @xanlens_ and DM us the link.`,
    suggested_tweet: `My brand "${brand}" scored ${overallScore}/100 (${grade}) on AI visibility 🔍\n\nHow visible is YOUR brand to ChatGPT, Gemini & Perplexity?\n\n@xanlens_`,
    report_url: reportUrl,
    note: "Tip: Post as text + image (no links) for better X reach. Download your score card from the report page.",
  };

  // ── Build dynamic fix guidance from audit data ──
  const websiteHealth = (responseData as Record<string, unknown>).website_health as { score: number; checks: Array<{ name: string; status: string; value: string; impact: string; recommendation?: string }> } | undefined;
  const auditBlindSpots = blindSpotDetails || [];
  const auditIndustry = (responseData as Record<string, unknown>).industry as string || industry || "";
  const auditCompetitors = ((responseData as Record<string, unknown>).competitors as string[]) || [];
  
  // ── Agent Instructions (fresh path) ──
  const freshHealthData = (responseData as Record<string, unknown>).website_health as { score: number; checks: Array<{ name: string; status: string; value: string; impact: string; recommendation?: string }> } | undefined;

  (responseData as Record<string, unknown>).agent_instructions = buildAgentInstructions({
    jobId,
    brand,
    website: website || "",
    industry: auditIndustry || industry || "",
    description: metaDescription || "",
    features: (metaFeatures as string[]) || [],
    keywords: (metaKeywords as string[]) || [],
    competitors: auditCompetitors || [],
    overallScore,
    grade,
    knowledgeScore: knowledge_score,
    discoverabilityScore: discoverability_score,
    citationScore,
    websiteHealthScore: freshHealthData?.score ?? 0,
    websiteHealthChecks: freshHealthData?.checks || [],
    engines: engineResults as Record<string, { score: number; mentions: number; sentiment: string; sample_snippets: string[]; prompts_tested: number }>,
    blindSpots: blindSpotDetails.map(b => ({ prompt: b.prompt, category: b.engine, type: b.type, severity: b.severity })),
    promptDetails: promptDetails as Array<{ prompt: string; engine: string; mentioned: boolean; blind_spot: boolean; snippet: string | null; category: string }>,
  });

  return NextResponse.json(responseData);
}
