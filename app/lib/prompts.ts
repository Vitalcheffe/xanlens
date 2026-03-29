/**
 * Prompt generation for GEO audits.
 * 
 * Distribution:
 *   Brand queries     ~5%   — "What is X?" (baseline only)
 *   Category queries  ~65%  — "Best [category]", "How to [use case]" (highest value)
 *   Competitor queries ~30% — "Alternatives to Y", "X vs Y" (comparison intent)
 *
 * Core insight: Users don't ask "What is MoonMaker?" — they ask 
 * "best crypto trading bot" and MoonMaker either shows up or doesn't.
 */

export type PromptCategory = "brand" | "category" | "competitor" | "buying_intent" | "conversational" | "discovery";

export interface CategorizedPrompt {
  prompt: string;
  category: PromptCategory;
}

// ── Dedup (case-insensitive) ──
function dedup(prompts: CategorizedPrompt[]): CategorizedPrompt[] {
  const seen = new Set<string>();
  return prompts.filter(p => {
    const key = p.prompt.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Expand ambiguous industry terms ──
function expandIndustry(industry: string): string {
  const lower = industry.toLowerCase().trim();
  const expansions: Record<string, string> = {
    "geo": "Generative Engine Optimization",
    "geo optimization": "Generative Engine Optimization",
    "seo": "Search Engine Optimization",
  };
  return expansions[lower] || industry;
}

/**
 * Build all prompts from enriched company data.
 * 
 * @param brand - Clean brand name
 * @param industry - Specific category (e.g. "crypto trading signals for AI agents")
 * @param competitors - 3-5 DIRECT competitors (same product, same audience)
 * @param keywords - 8-12 specific search phrases customers would use
 * @param features - 3-6 differentiating features (e.g. "x402 payments", "no API keys")
 * @param suggestedPrompts - 15 Gemini-suggested real user queries
 */
export function buildAllPrompts(
  brand: string,
  industry: string,
  competitors: string[] = [],
  keywords: string[] = [],
  features: string[] = [],
  suggestedPrompts: string[] = [],
): CategorizedPrompt[] {
  const ctx = expandIndustry(industry);
  const prompts: CategorizedPrompt[] = [];

  // ═══════════════════════════════════════════════════
  // BRAND (~5%) — 3 prompts. Just a baseline check.
  // Does the AI even know this brand exists?
  // ═══════════════════════════════════════════════════
  prompts.push(
    { prompt: `What is ${brand}?`, category: "brand" },
    { prompt: `What is ${brand} website?`, category: "brand" },
    { prompt: `${brand} review`, category: "brand" },
  );

  // ═══════════════════════════════════════════════════
  // CATEGORY (~65%) — The core of the audit.
  // These test real-world discoverability.
  // ═══════════════════════════════════════════════════

  // -- Gemini-suggested prompts (highest quality — from real user patterns) --
  for (const sp of suggestedPrompts) {
    // Classify based on content
    const lower = sp.toLowerCase();
    const cat: PromptCategory = /\b(which|should i|worth|pricing|afford|cheap|free|pay)\b/i.test(lower)
      ? "buying_intent"
      : /\b(how to|how do|set up|getting started|beginner)\b/i.test(lower)
        ? "discovery"
        : "category";
    prompts.push({ prompt: sp, category: cat });
  }

  // -- "Best X" — the #1 discovery pattern --
  prompts.push({ prompt: `Best ${ctx}`, category: "category" });
  for (const kw of keywords.slice(0, 5)) {
    prompts.push({ prompt: `Best ${kw}`, category: "category" });
  }

  // -- "Top X" / ranking --
  prompts.push({ prompt: `Top ${ctx} in 2025`, category: "category" });
  for (const kw of keywords.slice(0, 3)) {
    prompts.push({ prompt: `Top ${kw} in 2025`, category: "category" });
  }

  // -- "Best X with [feature]" — feature-specific discovery --
  for (const feat of features.slice(0, 4)) {
    prompts.push({ prompt: `Best ${ctx} with ${feat}`, category: "category" });
  }

  // -- Recommendation queries --
  prompts.push({ prompt: `Can you recommend a good ${ctx}?`, category: "category" });
  for (const kw of keywords.slice(0, 2)) {
    prompts.push({ prompt: `Can you recommend a ${kw}?`, category: "category" });
  }

  // -- "What are my options" --
  prompts.push(
    { prompt: `What are the best ${ctx}?`, category: "category" },
    { prompt: `What are my options for ${ctx}?`, category: "category" },
    { prompt: `${ctx} comparison`, category: "category" },
  );

  // -- Conversational discovery --
  prompts.push(
    { prompt: `I need a ${ctx}, what should I use?`, category: "conversational" },
    { prompt: `I'm looking for a ${ctx}`, category: "conversational" },
  );
  if (keywords.length > 0) {
    prompts.push({ prompt: `My company needs ${keywords[0]}, any suggestions?`, category: "conversational" });
  }

  // -- Buying intent --
  prompts.push(
    { prompt: `Which ${ctx} should I use?`, category: "buying_intent" },
    { prompt: `Best free ${ctx}`, category: "buying_intent" },
    { prompt: `${ctx} pricing comparison`, category: "buying_intent" },
    { prompt: `Most affordable ${ctx}`, category: "buying_intent" },
  );

  // -- Discovery / getting started --
  prompts.push(
    { prompt: `${ctx} for beginners`, category: "discovery" },
    { prompt: `How to get started with ${ctx}`, category: "discovery" },
    { prompt: `What is ${ctx}?`, category: "discovery" },
  );

  // ═══════════════════════════════════════════════════
  // COMPETITOR (~30%) — Does brand appear in competitor searches?
  // If no competitors found, reallocate to more category prompts.
  // ═══════════════════════════════════════════════════
  if (competitors.length > 0) {
    // Include industry context to disambiguate competitors with common names
    // e.g., "ai16z" vs "a16z" — without context engines confuse them
    const industryCtx = industry ? ` in ${industry}` : "";
    for (const comp of competitors.slice(0, 5)) {
      prompts.push(
        { prompt: `Alternatives to ${comp}${industryCtx}`, category: "competitor" },
        { prompt: `${brand} vs ${comp}`, category: "competitor" },
        { prompt: `Companies like ${comp}${industryCtx}`, category: "competitor" },
      );
    }

    // Multi-way comparisons
    if (competitors.length >= 2) {
      prompts.push(
        { prompt: `${brand} vs ${competitors[0]} vs ${competitors[1]}`, category: "competitor" },
        { prompt: `Which is better, ${competitors[0]} or ${competitors[1]}? Any alternatives?`, category: "competitor" },
      );
    }
    if (competitors.length >= 3) {
      prompts.push(
        { prompt: `Best alternative to ${competitors[0]} and ${competitors[1]}`, category: "competitor" },
      );
    }

    prompts.push({ prompt: `${brand} alternatives`, category: "competitor" });
  } else {
    // No competitors found — category is emerging.
    // Reallocate to more category/discovery prompts.
    prompts.push(
      { prompt: `${brand} alternatives`, category: "competitor" },
      { prompt: `Companies similar to ${brand}`, category: "competitor" },
    );
    // Extra category prompts to fill the gap
    for (const k of keywords.slice(0, 4)) {
      prompts.push(
        { prompt: `${k} tools 2025`, category: "category" },
        { prompt: `New ${k} platforms`, category: "category" },
      );
    }
    prompts.push(
      { prompt: `Emerging ${ctx} companies`, category: "category" },
      { prompt: `New players in ${ctx}`, category: "category" },
      { prompt: `${ctx} market overview`, category: "category" },
    );
  }

  return dedup(prompts);
}

// ── Prompt selection per engine tier ──
// Free audit: fewer prompts, free engines only
// Pro audit: all prompts, all engines
export function selectPrompts(allPrompts: CategorizedPrompt[], tier: "full" | "standard" | "lite"): CategorizedPrompt[] {
  if (tier === "full") return allPrompts;

  // Maintain the 5/65/30 distribution when trimming
  const limits: Record<PromptCategory, number> = tier === "standard"
    ? { brand: 2, category: 10, competitor: 5, buying_intent: 3, conversational: 2, discovery: 2 }
    : { brand: 2, category: 7, competitor: 4, buying_intent: 2, conversational: 1, discovery: 1 };

  const categories: PromptCategory[] = ["brand", "category", "competitor", "buying_intent", "conversational", "discovery"];
  const selected: CategorizedPrompt[] = [];

  for (const cat of categories) {
    const catPrompts = allPrompts.filter(p => p.category === cat);
    const limit = limits[cat] || 2;
    if (catPrompts.length <= limit) {
      selected.push(...catPrompts);
    } else {
      // Evenly spaced selection for variety
      const step = catPrompts.length / limit;
      for (let i = 0; i < limit; i++) {
        selected.push(catPrompts[Math.floor(i * step)]);
      }
    }
  }

  return selected;
}

// ── Persona prompts — REMOVED ──
// Persona-based prompts (technical buyer, executive, end user) were adding noise
// without real value. The best prompts are universal regardless of who asks.
// Keeping the types for backward compat but returning empty.
export type Persona = "technical_buyer" | "executive" | "end_user";
export interface PersonaPrompt extends CategorizedPrompt {
  persona: Persona;
}
export function buildPersonaPrompts(): PersonaPrompt[] {
  return []; // Disabled — no value add
}
