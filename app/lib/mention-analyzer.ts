// Smart brand mention analyzer with alias/domain detection
import { stemmer } from "stemmer";

export interface MentionResult {
  mentions: number;
  sentiment: string;
  genuine: boolean;
  snippets: string[];
}

// Build all possible variations of a brand name + website
function buildBrandVariations(brand: string, website?: string): string[] {
  const variations = new Set<string>();
  const brandLower = brand.toLowerCase().trim();
  
  // Original brand name
  variations.add(brandLower);
  
  // Without spaces
  variations.add(brandLower.replace(/\s+/g, ""));
  
  // With common separators
  if (brandLower.includes(" ")) {
    variations.add(brandLower.replace(/\s+/g, "-"));
    variations.add(brandLower.replace(/\s+/g, "_"));
  }
  
  // Domain-based variations
  if (website) {
    try {
      const url = website.startsWith("http") ? website : `https://${website}`;
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      // Full domain: replit.com
      variations.add(hostname);
      // Domain without TLD: replit
      const domainBase = hostname.split(".")[0];
      // Only add domain base if it's distinctive enough — skip generic words
      // that would cause false positives (e.g., "scanner" from scanner.pyxmate.com)
      const genericWords = new Set(["www", "app", "api", "web", "dev", "blog", "docs", "help", "mail", "shop", "store", "site", "portal", "dashboard", "admin", "scanner", "checker", "tool", "tools", "test", "demo", "search", "find", "get", "try", "go", "my", "the"]);
      if (domainBase.length >= 3 && !genericWords.has(domainBase)) {
        variations.add(domainBase);
      }
      // Handle .io, .ai, .co domains — the base is the brand (if not generic)
      if ((hostname.endsWith(".io") || hostname.endsWith(".ai") || hostname.endsWith(".co") || hostname.endsWith(".xyz")) && !genericWords.has(domainBase)) {
        variations.add(domainBase);
      }
      // For subdomains like scanner.pyxmate.com, also extract the main domain
      const parts = hostname.split(".");
      if (parts.length >= 3) {
        const mainDomain = parts[parts.length - 2];
        if (mainDomain.length >= 3 && !genericWords.has(mainDomain)) variations.add(mainDomain);
      }
    } catch {}
  }
  
  // Common patterns: "X AI" → also check "X.ai", "XAI"
  if (brandLower.endsWith(" ai")) {
    const base = brandLower.replace(/\s+ai$/, "");
    variations.add(base);
    variations.add(base + ".ai");
    variations.add(base + "ai");
  }

  // Prefix "ai" brands: "ai16z" → also check "a16z", "16z"
  // AI engines often drop or confuse the "ai" prefix
  if (brandLower.startsWith("ai") && brandLower.length > 3) {
    const withoutAi = brandLower.slice(2);
    if (withoutAi.length >= 3) variations.add(withoutAi);
    // Also "a" + rest: ai16z → a16z
    const aVariant = "a" + withoutAi;
    if (aVariant !== brandLower) variations.add(aVariant);
  }
  
  // Historical domains: replit → repl.it
  // Build "brand.tld" variations for short brand names
  if (brandLower.length <= 10 && !brandLower.includes(".")) {
    // Check for embedded TLD patterns: "replit" could be "repl.it"
    const tlds = ["it", "io", "ai", "co"];
    for (const tld of tlds) {
      if (brandLower.endsWith(tld) && brandLower.length > tld.length + 2) {
        const base = brandLower.slice(0, -tld.length);
        variations.add(`${base}.${tld}`);
      }
    }
  }

  // Filter out very short variations (< 3 chars) to avoid false positives
  return [...variations].filter(v => v.length >= 3);
}

function matchesBrand(text: string, variations: string[]): boolean {
  const lower = text.toLowerCase();
  return variations.some(v => lower.includes(v));
}

// ── Topic Alignment: Weighted Semantic Fingerprint ──
// Detects wrong-entity responses by comparing AI response against website-scraped keywords.
// Uses Porter stemming + term frequency density + hedge detection.
// Gate logic:
//   1. Any exact multi-word phrase match → gate passes (high-specificity anchor)
//   2. No exact phrases → count keywords with qualifying stem matches (density >= MIN_DENSITY, not near hedge)
//   3. Need 2+ qualifying keywords → gate passes
//   4. Gate fails → return 0 (wrong entity)

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "are", "was", "were",
  "been", "being", "have", "has", "had", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "not", "but", "what", "which", "who",
  "whom", "how", "when", "where", "why", "all", "each", "every", "both", "few",
  "more", "most", "other", "some", "such", "than", "too", "very", "just", "also",
  "into", "over", "after", "before", "between", "under", "about", "your", "their",
  "there", "here", "then", "them", "they", "these", "those", "its", "our", "his",
  "her", "she", "him", "you", "any", "only",
]);

// Hedge markers — AI disclaimers about "maybe you meant something else"
const HEDGE_MARKERS = [
  "if you are looking for", "if you're looking for",
  "did you mean", "do you mean", "please provide more context",
  "please clarify", "alternatively", "on the other hand",
  "could you provide more", "can you provide more",
  "provide more details", "provide more context",
];

const MIN_DENSITY = 0.005; // ~2 occurrences per 400 words

function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOP_WORDS.has(w));
}

function stemDensity(stem: string, tokensStemmed: string[]): number {
  if (tokensStemmed.length === 0) return 0;
  const count = tokensStemmed.filter(t => t === stem).length;
  return count / tokensStemmed.length;
}

function isNearHedge(stem: string, text: string, windowChars = 200): boolean {
  const lower = text.toLowerCase();
  const stemUnstemmed = stem; // We search for the stem in already-lowered text
  let idx = lower.indexOf(stemUnstemmed);
  while (idx !== -1) {
    const start = Math.max(0, idx - windowChars);
    const end = Math.min(lower.length, idx + windowChars);
    const window = lower.slice(start, end);
    if (HEDGE_MARKERS.some(h => window.includes(h))) return true;
    idx = lower.indexOf(stemUnstemmed, idx + 1);
  }
  return false;
}

function checkTopicAlignment(response: string, keywords: string[], brandLower: string): number {
  const responseNorm = response.toLowerCase();
  const brandWords = new Set(brandLower.split(/\s+/));
  const brandStems = new Set([...brandWords].filter(w => w.length >= 4).map(w => stemmer(w)));

  // Tokenize and stem the full response (as array for density counting)
  const responseTokens = tokenizeWords(response);
  const responseStemmed = responseTokens.map(w => stemmer(w));

  // Deduplicate and filter keywords
  const seen = new Set<string>();
  const validKeywords: string[] = [];
  for (const kw of keywords) {
    const kwLower = kw.toLowerCase().trim();
    if (kwLower.length < 3) continue;
    if (seen.has(kwLower)) continue;
    seen.add(kwLower);
    if (brandLower.includes(kwLower) || kwLower.includes(brandLower)) continue;
    if (brandWords.has(kwLower)) continue;
    validKeywords.push(kwLower);
  }

  if (validKeywords.length < 3) return 1; // Not enough keywords — pass through

  // Phase 1: Check exact multi-word phrase matches (anchors)
  let exactPhraseHits = 0;
  for (const kw of validKeywords) {
    if (kw.includes(" ") && responseNorm.includes(kw)) {
      exactPhraseHits++;
    }
  }

  // If any exact phrase matched → gate passes immediately
  if (exactPhraseHits > 0) return exactPhraseHits * 3; // Return positive score

  // Phase 2: No exact phrases — count keywords with qualifying stem matches
  // A keyword "qualifies" if at least one of its stems has sufficient density AND isn't near a hedge
  let qualifyingKeywords = 0;
  for (const kw of validKeywords) {
    const kwStems = kw
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length >= 4 && !STOP_WORDS.has(w))
      .map(w => stemmer(w))
      .filter(s => !brandStems.has(s));

    if (kwStems.length === 0) continue;

    const hasQualifyingMatch = kwStems.some(s => {
      const density = stemDensity(s, responseStemmed);
      if (density < MIN_DENSITY) return false; // Too rare — noise
      if (isNearHedge(s, response)) return false; // In disclaimer context
      return true;
    });

    if (hasQualifyingMatch) qualifyingKeywords++;
  }

  // Gate: need 2+ qualifying keywords from stems alone (without exact phrases)
  return qualifyingKeywords >= 2 ? qualifyingKeywords : 0;
}

/**
 * @param text - AI engine response text
 * @param brand - Brand name to search for
 * @param website - Brand's website URL (optional)
 * @param prompt - The prompt that was asked (optional, for echo detection)
 * @param descriptionKeywords - Keywords from the real company description (optional, for semantic validation)
 */
export function analyzeMentions(text: string, brand: string, website?: string, prompt?: string, descriptionKeywords?: string[]): MentionResult {
  if (!text) return { mentions: 0, sentiment: "unknown", genuine: false, snippets: [] };
  
  const lower = text.toLowerCase();
  const variations = buildBrandVariations(brand, website);

  const unknownPatterns = [
    "i don't have information", "i'm not familiar", "i couldn't find",
    "not widely known", "i don't recognize", "doesn't appear to be",
    "i am not aware", "i don't have specific", "i cannot find",
    "isn't a standard", "isn't a recognized",
    "could refer to", "might refer to", "no information available",
    "not a widely recognized", "not a widely known", "not a well-known",
    "could you provide more context", "can you provide more context",
    "can you tell me more", "could you tell me more",
    "i'm not sure what", "i am not sure what",
    "doesn't appear to be a widely", "not widely recognized",
    "i have no information", "no specific information",
    "not a recognized", "isn't widely known",
  ];

  // Echo patterns — AI just repeating the prompt without real knowledge
  const echoPatterns = [
    /^ok(?:ay)?,?\s+(?:i'm ready to|let me|let's|i'll|i can|sure,?\s+(?:i'll|let me))/i,
    /^(?:i'm ready to|let me|let's)\s+(?:review|dive into|look at|explore|discuss|analyze|help you with)/i,
    /^(?:sure|okay|alright|certainly),?\s+(?:i'll|let me|let's)\s+(?:review|look|help)/i,
    /^(?:here'?s? (?:what i (?:know|found)|my (?:review|analysis)).*:?\s*$)/im,
  ];

  // Check if response is just echoing the prompt back without substance
  function isEchoResponse(response: string): boolean {
    const trimmed = response.trim();
    // Very short response that just acknowledges
    if (trimmed.length < 100) {
      if (echoPatterns.some(p => p.test(trimmed))) return true;
    }
    // First sentence is echo, rest is generic filler
    const firstSentence = trimmed.split(/[.!?\n]/)[0]?.trim() || "";
    if (echoPatterns.some(p => p.test(firstSentence))) {
      // Check if the rest has real content about the brand (not just generic advice)
      const rest = trimmed.slice(firstSentence.length);
      const restLower = rest.toLowerCase();
      // If the rest doesn't contain specific facts (numbers, dates, features, competitors)
      const hasSpecifics = /\d{4}|\$\d|founded|headquarter|CEO|CTO|million|series [a-c]|competitor|feature|integration/i.test(rest);
      if (!hasSpecifics && rest.length < 300) return true;
    }
    // Check if brand only appears when echoing the prompt question
    if (prompt) {
      const brandLower = brand.toLowerCase();
      const promptLower = prompt.toLowerCase();
      // Remove the prompt text from the response, see if brand still appears
      const withoutPromptEcho = lower.replace(new RegExp(promptLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "");
      const brandStillPresent = variations.some(v => withoutPromptEcho.includes(v));
      // Also check for "it's a custom/internal" pattern — AI is guessing, not knowing
      const isGuessing = /it'?s a custom|could be a|might be a|appears to be a|seems to be a|isn'?t (?:a )?(?:widely|well) known/i.test(response);
      if (!brandStillPresent && isGuessing) return true;
    }
    return false;
  }

  const isEcho = isEchoResponse(text);

  const segments = text.split(/[.!?\n]+/);
  let mentions = 0;
  let unknownSegments = 0;
  let totalBrandSegments = 0;
  const snippets: string[] = [];
  
  for (const s of segments) {
    const sl = s.toLowerCase().trim();
    if (sl.length < 5) continue;
    if (!matchesBrand(sl, variations)) continue;
    totalBrandSegments++;
    if (unknownPatterns.some(p => sl.includes(p))) {
      unknownSegments++;
      continue;
    }
    mentions++;
    if (snippets.length < 3) snippets.push(s.trim().slice(0, 200));
  }

  // NOTE: We intentionally do NOT use raw string count as a fallback.
  // Raw count inflates mentions massively when AI echoes the brand name
  // in every sentence. Segment-based counting is more accurate.
  
  // Mark as not genuine if: all brand segments are unknown, OR it's an echo response
  let isUnknown = (totalBrandSegments > 0 && unknownSegments === totalBrandSegments) || isEcho;
  if (isUnknown) mentions = 0;

  // Wrong-entity detection is now handled by the LLM judge in the status route.
  // The judge runs on ALL responses where brand name was found (mentions > 0).
  // It compares the AI response against the real product description using Gemini Flash.
  // This replaces the previous keyword-based topic alignment gate and regex patterns,
  // which caused false negatives for brands described differently by AI engines.

  const positive = ["best", "great", "excellent", "leading", "top", "recommend", "popular", "trusted", "innovative"];
  const negative = ["worst", "bad", "poor", "avoid", "outdated", "lacking"];
  let pos = 0, neg = 0;
  for (const w of positive) if (lower.includes(w)) pos++;
  for (const w of negative) if (lower.includes(w)) neg++;
  const sentiment = (isUnknown && mentions === 0) ? "unknown" : pos > neg ? "positive" : neg > pos ? "negative" : "neutral";

  return { mentions, sentiment, genuine: !isUnknown && mentions > 0, snippets };
}

// Category weights — category/discovery prompts matter most, brand prompts are "gimmes"
const CATEGORY_WEIGHTS: Record<string, number> = {
  category: 3,
  discovery: 2.5,
  buying_intent: 2.5,
  competitor: 2,
  conversational: 2,
  brand: 1,
};

// Score a single prompt result: 0-100
export function scorePromptResult(analysis: MentionResult, isBlindSpotResult: boolean): number {
  if (!analysis.genuine || analysis.mentions === 0) {
    return 0;
  }

  // Base score by sentiment
  let base: number;
  if (analysis.sentiment === "positive") base = 80;
  else if (analysis.sentiment === "neutral") base = 55;
  else if (analysis.sentiment === "negative") base = 20;
  else base = 55; // unknown sentiment

  // Mention depth bonus: more mentions = more prominent = higher score
  // 1 mention = +0, 2 = +8, 3 = +13, 4+ = +18 (diminishing returns)
  const depthBonus = Math.min(20, Math.round(Math.log2(analysis.mentions) * 10));
  
  return Math.min(100, base + depthBonus);
}

// Score an engine using per-prompt weighted scoring
export function scoreEngineResponses(
  responses: Array<{ response: string; category: string; prompt: string }>,
  brand: string,
  website?: string,
  descriptionKeywords?: string[],
): {
  score: number; mentions: number; sentiment: string; snippets: string[];
} {
  if (responses.length === 0) return { score: 0, mentions: 0, sentiment: "unknown", snippets: [] };

  let weightedSum = 0;
  let totalWeight = 0;
  let totalMentions = 0;
  const allSnippets: string[] = [];
  let posCount = 0, negCount = 0, neuCount = 0;

  for (const r of responses) {
    if (!r.response) continue;
    const analysis = analyzeMentions(r.response, brand, website, r.prompt, descriptionKeywords);
    const blind = !analysis.genuine && isBlindSpotBasic(r.response);
    const promptScore = scorePromptResult(analysis, blind);
    const weight = CATEGORY_WEIGHTS[r.category] || 1;

    weightedSum += promptScore * weight;
    totalWeight += weight;
    totalMentions += analysis.mentions;
    if (analysis.genuine && allSnippets.length < 3) allSnippets.push(...analysis.snippets);
    if (analysis.sentiment === "positive") posCount++;
    else if (analysis.sentiment === "negative") negCount++;
    else neuCount++;
  }

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  const sentiment = totalMentions === 0 ? "unknown" : posCount > negCount ? "positive" : negCount > posCount ? "negative" : "neutral";
  return { score, mentions: totalMentions, sentiment, snippets: allSnippets };
}

// Lightweight blind spot check — status route has the full regex version
function isBlindSpotBasic(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.length > 100 &&
    !lower.includes("i don't have") &&
    !lower.includes("i'm not familiar") &&
    !lower.includes("i couldn't find") &&
    !lower.includes("no information available");
}
