/**
 * LLM Judge v17: Wrong-entity elimination.
 * 
 * Uses Gemini 3.1 Pro to verify if an AI response demonstrates knowledge
 * of the CORRECT brand/product — not a different product with the same name.
 */

import { createHash } from "crypto";

const GEMINI_API_KEY = process.env.GEMINI_JUDGE_KEY || process.env.GEMINI_API_KEY || "";
const JUDGE_MODEL = "gemini-3-flash-preview"; // Fast, thinking-enabled, best accuracy on disambiguation
const JUDGE_TIMEOUT_MS = 20000; // Allow time for thinking + response
const JUDGE_CACHE_TTL = 86400; // 24 hours

// Redis import — same pattern as the rest of the app
let redisGet: (key: string) => Promise<string | null>;
let redisSet: (key: string, value: string, ttl?: number) => Promise<void>;

async function initRedis() {
  if (!redisGet) {
    const redis = await import("@/app/lib/redis");
    redisGet = redis.redisGet;
    redisSet = redis.redisSet;
  }
}

const JUDGE_VERSION = "v25"; // v25: reverted grounding (too aggressive), keep dedicated key + v23 prompt
function hashKey(brand: string, response: string, productDescription?: string): string {
  const input = [brand.toLowerCase(), productDescription?.slice(0, 200) || "", response.slice(0, 6000)].join("|");
  return `judge:${JUDGE_VERSION}:${createHash("sha256").update(input).digest("hex").slice(0, 16)}`;
}

export interface JudgeResult {
  genuine: boolean;
  confidence: number; // 0 = no judgment (fallback), 1 = LLM judged
  cached?: boolean;
}

/**
 * Ask Gemini Pro whether an AI response demonstrates knowledge of the
 * correct brand/product.
 */
export async function llmJudgeMention(
  response: string,
  brand: string,
  productDescription: string,
  website?: string,
  industry?: string,
  promptCategory?: string,
): Promise<JudgeResult> {
  if (!GEMINI_API_KEY) {
    return { genuine: false, confidence: 0 };
  }

  if (!productDescription) {
    const parts = [brand];
    if (website) parts.push(`(${website})`);
    if (industry) parts.push(`— ${industry} company`);
    productDescription = parts.join(" ");
  }

  // Check cache
  try {
    await initRedis();
    const cacheKey = hashKey(brand, response, productDescription);
    const cached = await redisGet(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return { ...parsed, cached: true };
    }
  } catch {
    // Cache miss — continue
  }

  const truncatedResponse = response.slice(0, 6000);
  // Use up to 2000 chars of product description — enough for full website context
  const truncatedDescription = productDescription.slice(0, 2000);

  const prompt = `You are verifying whether an AI response EXPLICITLY mentions and discusses a SPECIFIC product/brand as a named entity.

BRAND NAME: "${brand}"
WEBSITE: ${website || "unknown"}
INDUSTRY: ${industry || "unknown"}

REFERENCE — THIS IS WHAT THE PRODUCT'S OWN WEBSITE SAYS:
${truncatedDescription}

AI RESPONSE TO EVALUATE:
${truncatedResponse}

YOUR TASK: Does the AI response mention "${brand}" AS A NAMED PRODUCT/BRAND/COMPANY?

CRITICAL RULE — COMMON WORDS:
Many brand names are also common English words (e.g., "Base", "Signal", "Edge", "Arc", "Linear", "Notion").
The word "${brand.toLowerCase()}" appearing as a regular English word DOES NOT count. Examples of NON-mentions:
- "based on current trends" — the word "based" is not a mention of the brand "Base"
- "the base layer of Ethereum" — generic usage, not the brand
- "a strong foundation/base for development" — generic usage
- "leading edge technology" — not about the brand "Edge"

A GENUINE MENTION means the AI is naming "${brand}" as a distinct entity — a product, platform, company, or service. Look for:
- The brand used as a proper noun/name: "Base is a Layer 2 network" ✓
- The brand's website mentioned: "${website || "N/A"}" ✓  
- The brand's parent company or unique features from the reference ✓
- The brand listed in a comparison or recommendation BY NAME ✓

Return TRUE ONLY if:
- "${brand}" appears as a NAMED ENTITY (proper noun) that matches the product in the REFERENCE
- The context confirms it's the same product (matching industry, features, parent company, or website)

Return FALSE if:
- The brand name only appears as a common English word (not as a product name)
- The response discusses the brand's industry but never names "${brand}" as a specific product
- The response is about a DIFFERENT product/concept sharing the same name
- The response is a disambiguation asking "which ${brand}?" without recommending it
- You cannot confirm "${brand}" is being discussed as the specific product from the REFERENCE

When in doubt, return FALSE.

Reply with ONLY: {"genuine": true} or {"genuine": false}`;

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), JUDGE_TIMEOUT_MS);

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${JUDGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 256 },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (res.status === 429) {
      const backoff = Math.min(1000 * Math.pow(2, attempt), 5000);
      console.warn(`[LLM Judge] 429 rate limited, retry ${attempt + 1}/${MAX_RETRIES} in ${backoff}ms`);
      await new Promise(r => setTimeout(r, backoff));
      continue;
    }

    if (!res.ok) {
      console.warn(`[LLM Judge] HTTP ${res.status} for brand "${brand}"`);
      return { genuine: false, confidence: 0 };
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = text.match(/\{\s*"genuine"\s*:\s*(true|false)\s*\}/);

    if (match) {
      const result: JudgeResult = { genuine: match[1] === "true", confidence: 1 };

      try {
        const cacheKey = hashKey(brand, response, productDescription);
        await redisSet(cacheKey, JSON.stringify({ genuine: result.genuine, confidence: 1 }), JUDGE_CACHE_TTL);
      } catch {
        // Cache write failure is non-critical
      }

      return result;
    }

    console.warn(`[LLM Judge] Could not parse response for brand "${brand}": ${text.slice(0, 100)}`);
    return { genuine: false, confidence: 0 };

  } catch (e: any) {
    if (e.name === "AbortError") {
      console.warn(`[LLM Judge] Timeout for brand "${brand}" attempt ${attempt + 1}`);
    } else {
      console.warn(`[LLM Judge] Error for brand "${brand}": ${e.message}`);
    }
    if (attempt < MAX_RETRIES - 1) continue;
    return { genuine: false, confidence: 0 };
  }
  } // end retry loop
  return { genuine: false, confidence: 0 };
}

/**
 * Batch judge multiple responses with concurrency control.
 * Optional onResult callback fires per-item so results are applied incrementally
 * even if the overall batch is cancelled by a timeout.
 */
export async function batchJudgeMentions(
  items: Array<{ index: number; response: string; brand: string; productDescription: string; website?: string; industry?: string; promptCategory?: string }>,
  concurrency = 5,
  onResult?: (index: number, result: JudgeResult) => void,
): Promise<Map<number, JudgeResult>> {
  const results = new Map<number, JudgeResult>();

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const result = await llmJudgeMention(item.response, item.brand, item.productDescription, item.website, item.industry, item.promptCategory);
        // Apply immediately so timeout can't discard completed results
        results.set(item.index, result);
        if (onResult) onResult(item.index, result);
        return { index: item.index, result };
      })
    );
  }

  return results;
}
